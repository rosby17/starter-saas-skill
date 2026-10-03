import { randomBytes } from 'crypto'
import { serviceClient } from '@/lib/auth/service-client'
import { isPlaceholder } from '@/lib/secrets/catalog'
import { exportSecretsFor, saveSecret } from '@/lib/secrets/store'
import { site } from '@/config/site'
import { coolify } from './coolify'
import { applyMigrations, copyAdmins, copyRows, waitForDatabase, type Db } from './database'
import { cloudflare, hostinger, type DnsProvider } from './dns'
import { createDeployKey, ensurePrivateRepo, githubLogin, pushProject } from './github'
import { DeployError, normalizeDomain, sleep } from './http'

// MISE EN LIGNE AUTOMATIQUE : du poste local jusqu'au site en HTTPS sur le domaine.
// Réglages (non secrets) dans system_settings « deploy » ; jetons dans /admin/keys (chiffrés).
// Chaque étape est rejouable : relancer reprend là où c'était resté, sans rien créer en double.

export type DeploySettings = {
  domain?: string
  dnsProvider?: 'hostinger' | 'cloudflare' | 'manual'
  serverUuid?: string
  serverIp?: string
  repoFullName?: string
  projectUuid?: string
  privateKeyUuid?: string
  appUuid?: string
  supabaseUuid?: string
}

export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'
export type DeployState = {
  running: boolean
  mode: 'full' | 'redeploy'
  startedAt: string
  finishedAt?: string
  steps: Array<{ id: string; label: string; status: StepStatus; detail?: string }>
  url?: string
  error?: string
}

const SETTINGS_KEY = 'deploy'
const STATE_KEY = 'deploy_state'

export async function getDeploySettings(): Promise<DeploySettings> {
  const { data } = await serviceClient().from('system_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle()
  return (data?.value || {}) as DeploySettings
}

export async function saveDeploySettings(patch: DeploySettings): Promise<DeploySettings> {
  const next = { ...(await getDeploySettings()), ...patch }
  const { error } = await serviceClient().from('system_settings').upsert({ key: SETTINGS_KEY, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
  return next
}

// Vrai pendant qu'une mise en ligne tourne dans CE processus.
let running = false

/** Adresse et clés de la base installée sur le serveur (variables générées par Coolify). */
async function prodDatabase(cf: ReturnType<typeof coolify>, uuid: string | undefined): Promise<Db & { anonKey: string }> {
  if (!uuid) throw new DeployError('Base de données en ligne absente : lance d’abord une mise en ligne complète.')
  const envs = await cf.serviceEnvs(uuid)
  const url = envs.SERVICE_URL_SUPABASEKONG || envs.SERVICE_FQDN_SUPABASEKONG
  const serviceKey = envs.SERVICE_SUPABASESERVICE_KEY, anonKey = envs.SERVICE_SUPABASEANON_KEY
  if (!serviceKey || !anonKey || !url) throw new DeployError('Clés de la base illisibles dans Coolify : donne au jeton Coolify le droit « root » (ou « read:sensitive »).')
  return { url: url.split(',')[0].replace(/\/+$/, ''), serviceKey, anonKey }
}

export async function getDeployState(): Promise<DeployState | null> {
  const { data } = await serviceClient().from('system_settings').select('value').eq('key', STATE_KEY).maybeSingle()
  const state = (data?.value as DeployState) || null
  // « En cours » mais aucun suivi dans ce processus : le serveur a redémarré pendant la mise en ligne
  // (cas normal d'un « Redéployer » lancé depuis le site en ligne : la nouvelle version remplace celle qui suivait).
  if (state?.running && !running) {
    const restartedOnNewVersion = state.mode === 'redeploy' && process.env.NODE_ENV === 'production'
      && state.steps.some((s) => s.id === 'deploy' && s.status === 'running')
    for (const s of state.steps) {
      if (s.status !== 'running' && s.status !== 'pending') continue
      if (restartedOnNewVersion && (s.id === 'deploy' || s.id === 'https')) {
        s.status = 'done'
        if (s.id === 'deploy') s.detail = 'le site a redémarré sur la nouvelle version'
      } else if (s.status === 'running') {
        s.status = 'error'
        s.detail = 'interrompu (serveur redémarré) : relance'
      }
    }
    state.running = false
    state.finishedAt = new Date().toISOString()
    if (!restartedOnNewVersion) state.error = 'Mise en ligne interrompue : relance-la.'
    await saveState(state)
  }
  return state
}

async function saveState(state: DeployState) {
  await serviceClient().from('system_settings').upsert({ key: STATE_KEY, value: state, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}

const env = (name: string) => (isPlaceholder(process.env[name]) ? '' : process.env[name]!)
const need = (name: string, label: string) => {
  const v = env(name)
  if (!v) throw new DeployError(`${label} manquant : renseigne-le dans Clés et intégrations (${name}).`)
  return v
}

export function dnsProviderFor(kind: DeploySettings['dnsProvider']): DnsProvider | null {
  if (kind === 'hostinger') return hostinger(need('HOSTINGER_API_TOKEN', 'Jeton Hostinger'))
  if (kind === 'cloudflare') return cloudflare(need('CLOUDFLARE_API_TOKEN', 'Jeton Cloudflare'))
  return null
}

/** Lance la mise en ligne en arrière-plan ; la page suit l'avancement avec getDeployState(). */
export async function startDeploy(mode: 'full' | 'redeploy'): Promise<void> {
  if (running) throw new DeployError('Une mise en ligne est déjà en cours.')
  if (mode === 'full' && process.env.NODE_ENV === 'production') {
    throw new DeployError('La première mise en ligne se lance depuis ton ordinateur (le code y est). En ligne, utilise « Redéployer ».')
  }
  const settings = await getDeploySettings()
  if (!settings.domain) throw new DeployError('Indique d’abord ton nom de domaine.')
  if (!settings.serverUuid || !settings.serverIp) throw new DeployError('Choisis d’abord le serveur Coolify.')

  const steps: DeployState['steps'] = mode === 'full'
    ? [
        { id: 'check', label: 'Vérification des clés', status: 'pending' },
        { id: 'dns', label: 'Domaine pointé vers le serveur', status: 'pending' },
        { id: 'github', label: 'Code envoyé dans un dépôt GitHub privé', status: 'pending' },
        { id: 'database', label: 'Base de données installée sur ton serveur', status: 'pending' },
        { id: 'app', label: 'Application créée dans Coolify', status: 'pending' },
        { id: 'env', label: 'Variables du serveur posées', status: 'pending' },
        { id: 'cron', label: 'Tâches automatiques programmées', status: 'pending' },
        { id: 'deploy', label: 'Construction et démarrage du site', status: 'pending' },
        { id: 'https', label: 'Site joignable en HTTPS', status: 'pending' },
      ]
    : [
        { id: 'check', label: 'Vérification des clés', status: 'pending' },
        { id: 'env', label: 'Variables du serveur mises à jour', status: 'pending' },
        { id: 'deploy', label: 'Reconstruction et redémarrage', status: 'pending' },
        { id: 'https', label: 'Site joignable en HTTPS', status: 'pending' },
      ]
  const state: DeployState = { running: true, mode, startedAt: new Date().toISOString(), steps }
  running = true
  await saveState(state)
  void execute(state, settings).finally(() => { running = false })
}

async function execute(state: DeployState, initial: DeploySettings) {
  let settings = initial
  const domain = normalizeDomain(settings.domain!)
  const siteUrl = `https://${domain}`
  const apiUrl = `https://api.${domain}`
  const step = async (id: string, fn: () => Promise<string | void>) => {
    const s = state.steps.find((x) => x.id === id)
    if (!s) return
    s.status = 'running'
    await saveState(state)
    const detail = await fn()
    s.status = detail === 'skipped' ? 'skipped' : 'done'
    if (detail && detail !== 'skipped') s.detail = detail
    await saveState(state)
  }

  try {
    const cf = coolify(need('COOLIFY_URL', 'Adresse de Coolify'), need('COOLIFY_API_TOKEN', 'Jeton Coolify'))

    await step('check', async () => {
      const servers = await cf.listServers()
      if (!servers.some((s) => s.uuid === settings.serverUuid)) throw new DeployError('Le serveur choisi n’existe plus dans Coolify.')
      if (state.mode === 'full') await githubLogin(need('GITHUB_TOKEN', 'Jeton GitHub'))
      need('SUPABASE_SERVICE_ROLE_KEY', 'Clé service Supabase')
    })

    await step('dns', async () => {
      const provider = dnsProviderFor(settings.dnsProvider)
      if (!provider) return 'skipped'
      await provider.pointToServer(domain, settings.serverIp!)
      return `${domain}, www et api → ${settings.serverIp}`
    })

    await step('github', async () => {
      const token = need('GITHUB_TOKEN', 'Jeton GitHub')
      const login = await githubLogin(token)
      const repoName = settings.repoFullName?.split('/')[1] || domain.replace(/\./g, '-')
      const repo = await ensurePrivateRepo(token, login, repoName)
      await pushProject(token, repo.fullName)
      settings = await saveDeploySettings({ repoFullName: repo.fullName })
      return repo.fullName
    })

    await step('database', async () => {
      // Supabase open source installé par Coolify sur le serveur du créateur, à l'adresse api.<domaine>.
      const projectUuid = settings.projectUuid || (await cf.createProject(site.name))
      settings = await saveDeploySettings({ projectUuid })
      const fresh = !(settings.supabaseUuid && (await cf.serviceExists(settings.supabaseUuid)))
      if (fresh) {
        const supabaseUuid = await cf.createSupabase({ projectUuid, serverUuid: settings.serverUuid!, apiUrl, name: `${domain} (base de données)` })
        settings = await saveDeploySettings({ supabaseUuid })
      }
      const uuid = settings.supabaseUuid!
      const smtpLogin = env('BREVO_SMTP_LOGIN'), smtpKey = env('BREVO_SMTP_KEY')
      const smtp = !!(smtpLogin && smtpKey && env('BREVO_SENDER_EMAIL'))
      await cf.setServiceEnvs(uuid, {
        API_EXTERNAL_URL: apiUrl,
        GOTRUE_SITE_URL: siteUrl,
        ADDITIONAL_REDIRECT_URLS: `${siteUrl}/**,https://www.${domain}/**`,
        // Sans SMTP, la base ne peut envoyer aucun e-mail : les comptes sont confirmés d'office.
        ENABLE_EMAIL_AUTOCONFIRM: smtp ? 'false' : 'true',
        ...(smtp ? {
          SMTP_HOST: 'smtp-relay.brevo.com', SMTP_PORT: '587', SMTP_USER: smtpLogin, SMTP_PASS: smtpKey,
          SMTP_ADMIN_EMAIL: env('BREVO_SENDER_EMAIL'), SMTP_SENDER_NAME: env('BREVO_SENDER_NAME') || site.name,
        } : {}),
      })
      if (fresh) await cf.startService(uuid)
      else await cf.restartService(uuid)

      const prod = await prodDatabase(cf, uuid)
      await waitForDatabase(prod, 30 * 60_000)
      const migrations = await applyMigrations(prod)
      // Ce qui a été préparé sur l'ordinateur part en ligne : administrateurs (même mot de passe),
      // réglages (passerelles…) et clés de /admin/keys, sans écraser ce qui existe déjà en ligne.
      const local: Db = { url: need('NEXT_PUBLIC_SUPABASE_URL', 'Adresse de la base locale'), serviceKey: need('SUPABASE_SERVICE_ROLE_KEY', 'Clé service locale') }
      const admins = await copyAdmins(local, prod)
      const { data: rows } = await serviceClient().from('system_settings').select('key, value').not('key', 'in', `(${SETTINGS_KEY},${STATE_KEY})`)
      await copyRows(prod, 'system_settings', rows ?? [], 'key')
      await copyRows(prod, 'app_secrets', await exportSecretsFor(env('APP_ENCRYPTION_KEY') || prod.serviceKey), 'name')
      return `${apiUrl} · ${migrations.length} migration(s) · ${admins} administrateur(s)`
    })

    await step('app', async () => {
      if (settings.appUuid && (await cf.appExists(settings.appUuid))) return 'déjà créée'
      const token = need('GITHUB_TOKEN', 'Jeton GitHub')
      const projectUuid = settings.projectUuid!
      let privateKeyUuid = settings.privateKeyUuid
      if (!privateKeyUuid) {
        const { privateKey } = await createDeployKey(token, settings.repoFullName!, `coolify-${domain}`)
        privateKeyUuid = await cf.addPrivateKey(`${domain} (dépôt GitHub)`, privateKey)
      }
      const appUuid = await cf.createApp({
        projectUuid, serverUuid: settings.serverUuid!, privateKeyUuid,
        gitRepository: `git@github.com:${settings.repoFullName}.git`, name: domain, domain,
      })
      settings = await saveDeploySettings({ projectUuid, privateKeyUuid, appUuid })
    })

    await step('env', async () => {
      if (!settings.appUuid) throw new DeployError('Application Coolify absente : lance d’abord une mise en ligne complète.')
      let cronSecret = env('CRON_SECRET')
      if (!cronSecret) {
        cronSecret = randomBytes(32).toString('hex')
        await saveSecret('CRON_SECRET', cronSecret)
      }
      // Clés de la base EN LIGNE (jamais celles de l'ordinateur) : lues dans Coolify, ou déjà en place si on est en ligne.
      const online = process.env.NODE_ENV === 'production'
      const prod = online
        ? { url: need('NEXT_PUBLIC_SUPABASE_URL', 'Adresse de la base'), anonKey: need('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Clé publique'), serviceKey: need('SUPABASE_SERVICE_ROLE_KEY', 'Clé service') }
        : await prodDatabase(cf, settings.supabaseUuid)
      if (!online) {
        // Réglages de mise en ligne recopiés en ligne : « Redéployer » fonctionnera aussi depuis le site.
        await copyRows(prod, 'system_settings', [{ key: SETTINGS_KEY, value: settings }], 'key', true)
      }
      const envs: Record<string, string> = {
        NEXT_PUBLIC_SUPABASE_URL: prod.url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: prod.anonKey,
        SUPABASE_SERVICE_ROLE_KEY: prod.serviceKey,
        NEXT_PUBLIC_SITE_URL: siteUrl,
        CRON_SECRET: cronSecret, // aussi dans le conteneur : les tâches programmées l'envoient
      }
      if (env('NEXT_PUBLIC_APP_NAME')) envs.NEXT_PUBLIC_APP_NAME = env('NEXT_PUBLIC_APP_NAME')
      if (env('APP_ENCRYPTION_KEY')) envs.APP_ENCRYPTION_KEY = env('APP_ENCRYPTION_KEY')
      await cf.setEnvs(settings.appUuid, envs)
    })

    await step('cron', async () => {
      const call = (path: string) => `wget -q -O /dev/null --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000${path}`
      await cf.ensureScheduledTasks(settings.appUuid!, [
        { name: 'Taux de change', command: call('/api/cron/update-rates'), frequency: '0 3 * * *' },
        { name: 'Expiration des crédits', command: call('/api/cron/expire-credits'), frequency: '30 3 * * *' },
        { name: 'Rattrapage Maketou', command: call('/api/cron/reverify-maketou-orders'), frequency: '*/15 * * * *' },
      ])
    })

    await step('deploy', async () => {
      const id = await cf.deploy(settings.appUuid!)
      await cf.waitDeployment(id)
    })

    await step('https', async () => {
      // Le certificat HTTPS arrive quand le DNS est propagé (de 1 à 30 minutes, parfois plus).
      const end = Date.now() + 30 * 60_000
      while (Date.now() < end) {
        try {
          const res = await fetch(`${siteUrl}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
          if (res.ok) return siteUrl
        } catch { /* pas encore joignable */ }
        await sleep(20_000)
      }
      throw new DeployError(`Le site est déployé mais ${siteUrl} ne répond pas encore : le domaine met parfois plusieurs heures à se propager. Relance « Redéployer » plus tard.`)
    })

    state.url = siteUrl
  } catch (error) {
    const current = state.steps.find((s) => s.status === 'running')
    if (current) { current.status = 'error'; current.detail = (error as Error).message }
    state.error = (error as Error).message
    console.error('Mise en ligne en échec :', error)
  } finally {
    state.running = false
    state.finishedAt = new Date().toISOString()
    await saveState(state)
  }
}
