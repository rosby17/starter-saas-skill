import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { serviceClient } from '@/lib/auth/service-client'
import { getPaymentProviderSettings } from '@/lib/payments/settings'
import { SECRET_CATALOG, getSecretDefinition, isPlaceholder, type SecretDefinition } from './catalog'

// Clés saisies dans /admin/keys : chiffrées en base (AES-256-GCM), puis posées dans process.env.
// Clé de chiffrement : APP_ENCRYPTION_KEY si elle existe, sinon dérivée de SUPABASE_SERVICE_ROLE_KEY
// (déjà obligatoire : rien de plus à configurer). Si l'une de ces deux valeurs change, les clés
// enregistrées deviennent illisibles : la page les signale « à ressaisir ».

const ORIGINAL_ENV = new Map<string, string | undefined>() // valeurs du serveur avant toute surcharge
let adminProvided = new Set<string>()
let unreadable = new Set<string>()

function encryptionKey(base = process.env.APP_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY): Buffer {
  if (!base) throw new Error('Ni APP_ENCRYPTION_KEY ni SUPABASE_SERVICE_ROLE_KEY : impossible de chiffrer les clés.')
  return createHash('sha256').update(`app-secrets:v1:${base}`).digest()
}

function encrypt(value: string, key = encryptionKey()): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':')
}

function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split(':')
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Format inconnu')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}

function rememberOriginal(name: string) {
  if (!ORIGINAL_ENV.has(name)) ORIGINAL_ENV.set(name, process.env[name])
}

function restoreOriginal(name: string) {
  rememberOriginal(name)
  const original = ORIGINAL_ENV.get(name)
  if (isPlaceholder(original)) delete process.env[name]
  else process.env[name] = original
}

/** Charge les clés de la base dans process.env. Appelée au démarrage, toutes les minutes
 *  (plusieurs instances) et juste après chaque modification dans l'admin. */
export async function applyStoredSecrets(): Promise<void> {
  // Base pas encore installée (assistant /setup pas encore passé) : rien à charger.
  if (!/^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL || '') || isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY)) return
  // Les exemples recopiés de .env.example ne doivent pas faire croire qu'une passerelle est configurée.
  for (const def of SECRET_CATALOG) {
    rememberOriginal(def.name)
    if (!adminProvided.has(def.name) && isPlaceholder(process.env[def.name])) delete process.env[def.name]
  }

  const { data, error } = await serviceClient().from('app_secrets').select('name, ciphertext')
  if (error) {
    console.error('Clés de l’admin non chargées (migration 0007 appliquée ?) :', error.message)
    return
  }
  const seen = new Set<string>()
  const broken = new Set<string>()
  for (const row of data ?? []) {
    if (!getSecretDefinition(row.name)) continue
    try {
      process.env[row.name] = decrypt(row.ciphertext)
      seen.add(row.name)
    } catch {
      broken.add(row.name)
    }
  }
  for (const name of adminProvided) if (!seen.has(name)) restoreOriginal(name)
  adminProvided = seen
  unreadable = broken
  if (broken.size) console.error('Clés illisibles (clé de chiffrement changée ?), à ressaisir dans /admin/keys :', [...broken].join(', '))
}

export async function saveSecret(name: string, value: string): Promise<void> {
  const { error } = await serviceClient()
    .from('app_secrets')
    .upsert({ name, ciphertext: encrypt(value), updated_at: new Date().toISOString() }, { onConflict: 'name' })
  if (error) throw error
  await applyStoredSecrets()
}

/** Clés enregistrées ici, rechiffrées pour une autre base (mise en ligne : la clé de chiffrement du serveur diffère).
 *  targetBase = APP_ENCRYPTION_KEY du serveur, ou à défaut sa clé service Supabase. */
export async function exportSecretsFor(targetBase: string): Promise<Array<{ name: string; ciphertext: string }>> {
  const { data, error } = await serviceClient().from('app_secrets').select('name, ciphertext')
  if (error) throw error
  const key = encryptionKey(targetBase)
  const out: Array<{ name: string; ciphertext: string }> = []
  for (const row of data ?? []) {
    try { out.push({ name: row.name, ciphertext: encrypt(decrypt(row.ciphertext), key) }) } catch { /* illisible ici : à ressaisir en ligne */ }
  }
  return out
}

export async function deleteSecret(name: string): Promise<void> {
  const { error } = await serviceClient().from('app_secrets').delete().eq('name', name)
  if (error) throw error
  await applyStoredSecrets()
}

export type SecretStatus = Omit<SecretDefinition, 'requirement'> & {
  source: 'admin' | 'server' | 'missing'
  required: boolean
  /** true : clé facultative quel que soit le réglage (n'empêche jamais un service d'être « Configuré »). */
  optional: boolean
  unreadable: boolean
  /** Fin de la valeur pour la reconnaître, jamais la valeur entière d'un secret. */
  preview: string | null
}

function preview(def: SecretDefinition, value: string): string {
  if (!def.secret) return value
  return value.length >= 12 ? `••••${value.slice(-4)}` : '••••'
}

export async function getSecretsStatus(): Promise<SecretStatus[]> {
  let activeGateways = new Set<string>()
  try {
    activeGateways = new Set(Object.values(await getPaymentProviderSettings(serviceClient())).map((s) => s.active))
  } catch (error) {
    console.error('Passerelles actives illisibles :', error)
  }
  return SECRET_CATALOG.map(({ requirement, ...def }) => {
    const value = process.env[def.name]
    const source = isPlaceholder(value) ? 'missing' : adminProvided.has(def.name) ? 'admin' : 'server'
    const required = requirement.kind === 'always' || (requirement.kind === 'gateway' && activeGateways.has(requirement.id))
    return { ...def, source, required, optional: requirement.kind === 'optional', unreadable: unreadable.has(def.name), preview: source === 'missing' ? null : preview({ ...def, requirement }, value!) }
  })
}

/** Valeurs ENTIÈRES des clés demandées (valeur posée, sinon valeur par défaut du code), pour pré-remplir
 *  la fenêtre de l'admin : l'administrateur voit (œil) et corrige directement ce qui est en place.
 *  Réservé aux routes qui ont vérifié requireAdmin(). */
export function getSecretValues(names: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of names) {
    const def = getSecretDefinition(name)
    if (!def) continue
    const value = process.env[name]
    out[name] = !isPlaceholder(value) ? value! : def.defaultValue ?? ''
  }
  return out
}

export async function countMissingRequiredSecrets(): Promise<number> {
  return (await getSecretsStatus()).filter((s) => s.required && s.source === 'missing').length
}
