import { serviceClient } from '@/lib/auth/service-client'

// Réglages des moteurs, dans system_settings (clé « engine_routing ») :
//  - active : moteur actif de chaque modèle (absent = le premier moteur du modèle, voir catalog.ts) ;
//  - autoFallback : bascule automatique vers un autre moteur du même modèle. COUPÉE PAR DÉFAUT ;
//  - watchdog : la sonde des moteurs tourne-t-elle ? COUPÉE PAR DÉFAUT (chaque essai est un petit appel payant).
// Lus à chaque demande avec un cache de 15 s ; en cas de doute (base injoignable), on garde le dernier état connu,
// sinon les valeurs par défaut (aucune bascule, aucune sonde).
const KEY = 'engine_routing'
const CACHE_MS = 15_000

export type EngineSettings = { active: Record<string, string>; autoFallback: boolean; watchdog: boolean }
const DEFAULTS: EngineSettings = { active: {}, autoFallback: false, watchdog: false }

let cache: { at: number; value: EngineSettings } | null = null

function normalize(raw: unknown): EngineSettings {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<EngineSettings>
  const active = value.active && typeof value.active === 'object'
    ? Object.fromEntries(Object.entries(value.active).filter(([k, v]) => typeof k === 'string' && typeof v === 'string'))
    : {}
  return { active, autoFallback: value.autoFallback === true, watchdog: value.watchdog === true }
}

export async function readEngineSettings(options: { fresh?: boolean } = {}): Promise<EngineSettings> {
  if (!options.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value
  try {
    const { data, error } = await serviceClient().from('system_settings').select('value').eq('key', KEY).maybeSingle()
    if (error) throw error
    const value = normalize(data?.value)
    cache = { at: Date.now(), value }
    return value
  } catch (error) {
    console.error('[engines] lecture des réglages impossible', error)
    return cache?.value ?? DEFAULTS
  }
}

export async function updateEngineSettings(patch: (current: EngineSettings) => EngineSettings): Promise<EngineSettings> {
  const next = normalize(patch(await readEngineSettings({ fresh: true })))
  const { error } = await serviceClient().from('system_settings').upsert({ key: KEY, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
  cache = { at: Date.now(), value: next }
  return next
}
