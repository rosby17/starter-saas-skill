import { execFile } from 'child_process'
import { promisify } from 'util'
import { DeployError } from './http'

// SUPABASE EN LOCAL (ordinateur du créateur) : la base tourne dans Docker grâce au CLI Supabase.
// Ports propres à chaque projet (supabase/config.toml, posés par le script de création) : plusieurs SaaS cohabitent.

const run = promisify(execFile)

async function exec(args: string[], timeoutMs: number) {
  if (process.env.NODE_ENV === 'production') throw new DeployError('Réservé à l’ordinateur du créateur.')
  const opts = { cwd: process.cwd(), timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } }
  try {
    return await run('supabase', args, opts)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return run('npx', ['-y', 'supabase', ...args], opts) // CLI non installé : version téléchargée à la volée
  }
}

export async function dockerRunning(): Promise<boolean> {
  try {
    await run('docker', ['info'], { timeout: 15_000, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` } })
    return true
  } catch {
    return false
  }
}

export type LocalKeys = { url: string; anonKey: string; serviceKey: string }

/** Clés de la base locale si elle tourne, sinon null. */
export async function localStatus(): Promise<LocalKeys | null> {
  try {
    const { stdout } = await exec(['status', '-o', 'env'], 60_000)
    const get = (k: string) => stdout.match(new RegExp(`^${k}="?([^"\\n]+)"?$`, 'm'))?.[1]
    const url = get('API_URL'), anonKey = get('ANON_KEY'), serviceKey = get('SERVICE_ROLE_KEY')
    return url && anonKey && serviceKey ? { url, anonKey, serviceKey } : null
  } catch {
    return null
  }
}

/** Démarre la base (premier lancement : téléchargement des images Docker, 3 à 10 minutes). */
export async function startLocal(): Promise<LocalKeys> {
  if (!(await dockerRunning())) throw new DeployError('Docker n’est pas lancé : ouvre Docker Desktop, attends qu’il soit prêt, puis reclique.')
  try {
    await exec(['start'], 20 * 60_000)
  } catch (error) {
    const out = `${(error as { stderr?: string }).stderr || ''}${(error as Error).message}`
    if (/port is already allocated|address already in use/i.test(out)) {
      throw new DeployError('Un port de la base est déjà pris par un autre projet : demande à Claude de changer les ports dans supabase/config.toml.')
    }
    throw new DeployError(`La base locale n’a pas démarré : ${out.slice(-400)}`)
  }
  const keys = await localStatus()
  if (!keys) throw new DeployError('Base démarrée mais clés introuvables (supabase status).')
  return keys
}
