// MISE EN LIGNE DIRECTE sur ton serveur Coolify : aucun lancement local, aucune base locale.
// Usage : npx -y tsx scripts/deployer.ts            (première mise en ligne, ou mise à jour : rejouable)
// PROFIL SERVEUR (une seule fois pour tous tes SaaS) : Coolify, GitHub, DNS et serveur sont gardés dans
// ~/.starter-saas/serveur.json (droits 600, hors Git) et réutilisés par chaque nouveau SaaS : il ne reste que le domaine à donner.
// L'état propre au SaaS (dépôt, application, base) est dans .deploy.json (ignoré par Git, droits 600).
// À la fin, le script affiche le lien /setup du site EN LIGNE pour créer le compte administrateur.
import { randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promises as dnsp } from 'dns'
import readline from 'readline'
import { coolify } from '../src/lib/deploy/coolify'
import { CRON_TASKS } from '../src/lib/deploy/cron-tasks'
import { applyMigrations, waitForDatabase } from '../src/lib/deploy/database'
import { cloudflare, hostinger, type DnsProvider } from '../src/lib/deploy/dns'
import { createDeployKey, ensurePrivateRepo, githubLogin, pushProject } from '../src/lib/deploy/github'
import { DeployError, normalizeDomain, sleep } from '../src/lib/deploy/http'

type Config = {
  COOLIFY_URL?: string; COOLIFY_API_TOKEN?: string; GITHUB_TOKEN?: string
  DOMAIN?: string; DNS_PROVIDER?: 'hostinger' | 'cloudflare' | 'manual'
  HOSTINGER_API_TOKEN?: string; CLOUDFLARE_API_TOKEN?: string
  serverUuid?: string; serverIp?: string; repoFullName?: string; projectUuid?: string
  privateKeyUuid?: string; appUuid?: string; supabaseUuid?: string
  SETUP_TOKEN?: string; CRON_SECRET?: string; APP_ENCRYPTION_KEY?: string
}

const FILE = path.join(process.cwd(), '.deploy.json')
const PROFILE_DIR = path.join(os.homedir(), '.starter-saas')
const PROFILE = path.join(PROFILE_DIR, 'serveur.json')
const PROFILE_KEYS = ['COOLIFY_URL', 'COOLIFY_API_TOKEN', 'GITHUB_TOKEN', 'DNS_PROVIDER', 'HOSTINGER_API_TOKEN', 'CLOUDFLARE_API_TOKEN', 'serverUuid', 'serverIp', 'BASE_DOMAIN'] as const
let cfg: Config & { BASE_DOMAIN?: string } = {}
const save = async () => {
  await fs.writeFile(FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 })
  await fs.mkdir(PROFILE_DIR, { recursive: true, mode: 0o700 })
  const shared = Object.fromEntries(PROFILE_KEYS.filter((k) => cfg[k]).map((k) => [k, cfg[k]]))
  await fs.writeFile(PROFILE, JSON.stringify(shared, null, 2), { mode: 0o600 })
}
const log = (m: string) => console.log(`\n▸ ${m}`)

function ask(question: string, secret = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (secret) (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); else if (s === '\r\n' || s === '\n') process.stdout.write(s) }
    rl.question(`${question} `, (a) => { rl.close(); resolve(a.trim()) })
  })
}

// Affiche le lien en entier (cliquable dans le Terminal : ⌘+clic) et l'ouvre dans le navigateur.
const lien = (url: string) => {
  console.log(`  👉 ${url}`)
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'
  execFile(opener, [url], () => undefined)
}

async function need(key: keyof Config, question: string, secret = false, guide = '', url = ''): Promise<string> {
  const fromEnv = process.env[key as string]
  if (fromEnv && !cfg[key]) (cfg as Record<string, unknown>)[key] = fromEnv
  if (!cfg[key] && guide) { console.log(`\n${guide}`); if (url) lien(url) }
  while (!cfg[key]) (cfg as Record<string, unknown>)[key] = await ask(question, secret)
  await save()
  return cfg[key] as string
}

async function main() {
  try { cfg = JSON.parse(await fs.readFile(PROFILE, 'utf8')) } catch { /* pas encore de profil serveur */ }
  const known = !!cfg.COOLIFY_API_TOKEN
  try { cfg = { ...cfg, ...JSON.parse(await fs.readFile(FILE, 'utf8')) } } catch { /* première fois pour ce SaaS */ }
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8')) as { name: string }
  console.log(known ? 'Profil serveur trouvé (~/.starter-saas) : il ne manque que le domaine de ce SaaS.' : 'Première mise en ligne : je retiens ces réponses pour tous tes prochains SaaS.')

  const coolifyUrl = (await need('COOLIFY_URL', 'Adresse de ton Coolify (ex. https://coolify.mondomaine.com) :', false,
    'COOLIFY — adresse : celle que tu tapes dans le navigateur pour ouvrir ton tableau de bord Coolify (sans /dashboard à la fin).')).replace(/\/+$/, '')
  const cf = coolify(coolifyUrl, await need('COOLIFY_API_TOKEN', 'Jeton API Coolify :', true,
    'COOLIFY — jeton API : dans Coolify, menu de gauche « Keys & Tokens » → onglet « API tokens » → « Create New Token ».\n  Donne un nom (ex. starter-saas), coche « root » (accès complet, nécessaire pour lire les clés de la base), clique « Create » puis copie le jeton\n  (il ne s’affiche qu’une fois). Si « API access » est désactivé : Settings → Configuration → « Advanced » → active « API Access ».',
    `${coolifyUrl}/security/api-tokens`))
  const githubToken = await need('GITHUB_TOKEN', 'Jeton GitHub :', true,
    'GITHUB — jeton : github.com/settings/tokens → « Generate new token (classic) », nom libre, expiration au choix, coche UNIQUEMENT « repo », puis « Generate token » et copie-le.\n  Il sert à créer un dépôt PRIVÉ pour ce SaaS et à y envoyer le code, que Coolify ira ensuite récupérer.\n  (La page s’ouvre avec « repo » déjà coché : descends en bas, clique « Generate token », copie le jeton.)',
    'https://github.com/settings/tokens/new?scopes=repo&description=starter-saas')
  if (!cfg.DOMAIN && cfg.BASE_DOMAIN) {
    const sub = await ask(`Adresse du site : « ${pkg.name} » donnera ${pkg.name}.${cfg.BASE_DOMAIN} (Entrée pour accepter, ou tape un autre domaine) :`)
    cfg.DOMAIN = !sub ? `${pkg.name}.${cfg.BASE_DOMAIN}` : sub; await save()
  }
  const domain = normalizeDomain(await need('DOMAIN', 'Nom de domaine du site (ex. monsite.com) :', false,
    'DOMAINE : l’adresse publique du site. Le script crée aussi www.<domaine> et api.<domaine> (la base de données). Le domaine doit déjà t’appartenir.'))
  if (!cfg.BASE_DOMAIN && domain.split('.').length >= 2) { cfg.BASE_DOMAIN = domain.split('.').slice(-2).join('.'); await save() }
  if (!cfg.DNS_PROVIDER) {
    const a = (await ask('Fournisseur du domaine : 1 = Hostinger, 2 = Cloudflare, 3 = je règle le DNS moi-même :')) || '3'
    cfg.DNS_PROVIDER = a === '1' ? 'hostinger' : a === '2' ? 'cloudflare' : 'manual'
    await save()
  }
  let dns: DnsProvider | null = null
  if (cfg.DNS_PROVIDER === 'hostinger') dns = hostinger(await need('HOSTINGER_API_TOKEN', 'Jeton API Hostinger :', true,
    'HOSTINGER — jeton : hpanel.hostinger.com → ton profil (en haut à droite) → « API » → « Générer un jeton ». Il sert à pointer le domaine vers ton serveur (enregistrements DNS).',
    'https://hpanel.hostinger.com/profile/api'))
  if (cfg.DNS_PROVIDER === 'cloudflare') dns = cloudflare(await need('CLOUDFLARE_API_TOKEN', 'Jeton API Cloudflare :', true,
    'CLOUDFLARE — jeton : dash.cloudflare.com → Mon profil → « Jetons API » → « Créer un jeton » → modèle « Modifier la zone DNS » → choisis ta zone (ton domaine) → crée et copie le jeton.',
    'https://dash.cloudflare.com/profile/api-tokens'))

  log('Connexion à ton Coolify : quels serveurs peut-il utiliser ?')
  const servers = await cf.listServers()
  if (!servers.length) throw new DeployError('Aucun serveur dans ce Coolify : ajoute-en un (Servers → Add) puis relance.')
  servers.forEach((sv, i) => console.log(`  ${i + 1}. ${sv.name}  (${sv.ip})${sv.uuid === cfg.serverUuid ? '   ← utilisé la dernière fois' : ''}`))
  const previous = Math.max(0, servers.findIndex((sv) => sv.uuid === cfg.serverUuid))
  const pick = await ask(`Sur quel serveur installer ce SaaS ? (numéro, Entrée = ${previous + 1}) :`)
  const server = servers[Number(pick) - 1] || servers[previous]
  cfg.serverUuid = server.uuid; cfg.serverIp = server.ip; await save()
  console.log(`  → serveur choisi : ${server.name} (${server.ip})`)

  const login = await githubLogin(githubToken)
  const siteUrl = `https://${domain}`, apiUrl = `https://api.${domain}`

  console.log(`
────────── CE QUE JE VAIS FAIRE (rien n'a encore été créé) ──────────
 Serveur         : ${server.name} (${server.ip})
 Projet Coolify  : « ${pkg.name} » (un projet dédié, séparé de tes autres applications)
 Ressources      : (chacune est un conteneur Docker)
   1. Base de données Supabase : Postgres, API (${apiUrl}), authentification, stockage
   2. Application « ${domain} » : construite depuis le dépôt GitHub privé ${login}/${cfg.repoFullName?.split('/')[1] || domain.replace(/\./g, '-')}
 Variables       : clés de la base, adresse du site, secrets (CRON_SECRET, chiffrement, SETUP_TOKEN) posées dans l'application
 Domaine         : ${domain}, www.${domain} et api.${domain} → ${server.ip} (${cfg.DNS_PROVIDER === 'manual' ? 'à régler par toi chez ton fournisseur' : 'automatique chez ' + cfg.DNS_PROVIDER}), HTTPS automatique
 Tâches          : ${CRON_TASKS.length} tâches programmées
──────────────────────────────────────────────────────────────────────`)
  if (!/^(o|oui|y|yes)$/i.test(await ask('On y va ? (oui/non) :'))) { console.log('Arrêt : rien n’a été modifié.'); return }

  if (dns) { log('Domaine → serveur'); await dns.pointToServer(domain, server.ip); console.log(`  ${domain}, www et api → ${server.ip}`) }
  else console.log(`\n⚠ DNS à régler chez ton fournisseur : ${domain}, www.${domain} et api.${domain} → ${server.ip} (enregistrements A).`)

  log('Code envoyé dans un dépôt GitHub privé')
  const repo = await ensurePrivateRepo(githubToken, login, cfg.repoFullName?.split('/')[1] || domain.replace(/\./g, '-'))
  console.log('  Envoi du code (la première fois, les vidéos et images peuvent le rendre long : plusieurs minutes sur une connexion lente, ce n’est pas bloqué)…')
  await pushProject(githubToken, repo.fullName)
  cfg.repoFullName = repo.fullName; await save()

  log('Base de données sur ton serveur (la première fois : 3 à 10 minutes)')
  cfg.projectUuid ||= await cf.createProject(pkg.name); await save()
  const fresh = !(cfg.supabaseUuid && (await cf.serviceExists(cfg.supabaseUuid)))
  if (fresh) { cfg.supabaseUuid = await cf.createSupabase({ projectUuid: cfg.projectUuid, serverUuid: server.uuid, apiUrl, name: `${domain} (base de données)` }); await save() }
  await cf.setServiceEnvs(cfg.supabaseUuid!, {
    API_EXTERNAL_URL: apiUrl, GOTRUE_SITE_URL: siteUrl,
    ADDITIONAL_REDIRECT_URLS: `${siteUrl}/**,https://www.${domain}/**`,
    ENABLE_EMAIL_AUTOCONFIRM: 'true', // l'e-mail se règle ensuite dans /admin/keys (Brevo)
  })
  await cf.fixSupabaseImages(cfg.supabaseUuid!)
  if (fresh) await cf.startService(cfg.supabaseUuid!); else await cf.restartService(cfg.supabaseUuid!)
  const envs = await cf.serviceEnvs(cfg.supabaseUuid!)
  const dbUrl = (envs.SERVICE_URL_SUPABASEKONG || envs.SERVICE_FQDN_SUPABASEKONG || '').split(',')[0].replace(/\/+$/, '')
  const serviceKey = envs.SERVICE_SUPABASESERVICE_KEY, anonKey = envs.SERVICE_SUPABASEANON_KEY
  if (!dbUrl || !serviceKey || !anonKey) throw new DeployError('Clés de la base illisibles : donne au jeton Coolify le droit « root ».')
  // La base répond sur api.<domaine> : tant que ce nom ne pointe pas vers le serveur, rien ne peut aboutir.
  for (let i = 0; ; i++) {
    const ips = await dnsp.resolve4(`api.${domain}`).catch(() => [] as string[])
    if (ips.includes(server.ip)) break
    if (i % 3 === 0) console.log(`  ⏳ En attente du DNS : crée l'enregistrement A  api.${domain} → ${server.ip}  (chez Cloudflare : « DNS uniquement », nuage GRIS). Aujourd'hui il pointe vers : ${ips.join(', ') || 'rien'}`)
    await sleep(20_000)
  }
  await waitForDatabase({ url: dbUrl, serviceKey }, 30 * 60_000)
  const migrations = await applyMigrations({ url: dbUrl, serviceKey })
  console.log(`  ${apiUrl} · ${migrations.length} migration(s) appliquée(s)`)

  log('Application Coolify')
  if (!(cfg.appUuid && (await cf.appExists(cfg.appUuid)))) {
    if (!cfg.privateKeyUuid) {
      const { privateKey } = await createDeployKey(githubToken, repo.fullName, `coolify-${domain}`)
      cfg.privateKeyUuid = await cf.addPrivateKey(`${domain} (dépôt GitHub)`, privateKey)
    }
    cfg.appUuid = await cf.createApp({ projectUuid: cfg.projectUuid, serverUuid: server.uuid, privateKeyUuid: cfg.privateKeyUuid, gitRepository: `git@github.com:${repo.fullName}.git`, name: domain, domain })
    await save()
  }
  cfg.CRON_SECRET ||= randomBytes(32).toString('hex')
  cfg.APP_ENCRYPTION_KEY ||= randomBytes(32).toString('hex')
  cfg.SETUP_TOKEN ||= randomBytes(24).toString('hex')
  await save()
  await cf.setEnvs(cfg.appUuid!, {
    NEXT_PUBLIC_SUPABASE_URL: dbUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    NEXT_PUBLIC_SITE_URL: siteUrl, CRON_SECRET: cfg.CRON_SECRET, APP_ENCRYPTION_KEY: cfg.APP_ENCRYPTION_KEY, SETUP_TOKEN: cfg.SETUP_TOKEN,
  })
  await cf.ensureScheduledTasks(cfg.appUuid!, CRON_TASKS)

  log('Construction et démarrage du site')
  await cf.waitDeployment(await cf.deploy(cfg.appUuid!))

  log('Attente du site en HTTPS (le domaine met de 1 à 30 minutes à se propager)')
  const end = Date.now() + 30 * 60_000
  let up = false
  while (Date.now() < end && !up) {
    try { up = (await fetch(`${siteUrl}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })).ok } catch { /* pas encore */ }
    if (!up) await sleep(20_000)
  }
  if (!up) throw new DeployError(`Déployé, mais ${siteUrl} ne répond pas encore (DNS en cours de propagation). Relance ce script plus tard.`)

  console.log('\nVariables posées dans l’application Coolify : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL, CRON_SECRET, APP_ENCRYPTION_KEY, SETUP_TOKEN.')
  console.log(`\n✅ Site EN LIGNE : ${siteUrl}`)
  console.log(`Crée ton compte administrateur (une seule fois) : ${siteUrl}/setup?token=${cfg.SETUP_TOKEN}`)
}

main().catch((e) => { console.error(`\n✖ ${(e as Error).message}`); process.exit(1) })
