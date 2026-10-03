import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { callJson, DeployError } from './http'

const run = promisify(execFile)
const API = 'https://api.github.com'

// Jeton GitHub : github.com/settings/tokens (classique, droit « repo ») ou à grain fin
// (Administration + Contents en écriture). Le dépôt est TOUJOURS créé en privé.
export async function githubLogin(token: string): Promise<string> {
  return (await callJson<{ login: string }>('GitHub', `${API}/user`, token)).login
}

export async function ensurePrivateRepo(token: string, owner: string, name: string): Promise<{ fullName: string; sshUrl: string }> {
  const existing = await callJson<{ full_name: string; ssh_url: string; private: boolean } | null>('GitHub', `${API}/repos/${owner}/${name}`, token, { okStatuses: [404] })
  if (existing && existing.full_name) {
    if (!existing.private) await callJson('GitHub', `${API}/repos/${owner}/${name}`, token, { method: 'PATCH', body: { private: true } })
    return { fullName: existing.full_name, sshUrl: existing.ssh_url }
  }
  const repo = await callJson<{ full_name: string; ssh_url: string }>('GitHub', `${API}/user/repos`, token, {
    method: 'POST',
    body: { name, private: true, auto_init: false, description: 'SaaS créé avec starter-saas' },
  })
  return { fullName: repo.full_name, sshUrl: repo.ssh_url }
}

/** Enregistre tout le travail local et le pousse sur la branche main du dépôt privé.
 *  Le jeton passe par une variable d'environnement de git, jamais dans la ligne de commande ni dans .git/config. */
export async function pushProject(token: string, fullName: string): Promise<void> {
  const cwd = process.cwd()
  const git = (args: string[], extraEnv: Record<string, string> = {}) =>
    run('git', ['-c', 'user.name=starter-saas', '-c', 'user.email=deploy@starter-saas.local', ...args], { cwd, env: { ...process.env, ...extraEnv }, maxBuffer: 10 * 1024 * 1024 })
  try {
    await run('git', ['rev-parse', '--is-inside-work-tree'], { cwd })
  } catch {
    await git(['init', '-q'])
  }
  await git(['add', '-A'])
  // Garde-fou : jamais de fichier d'environnement dans Git.
  const { stdout: staged } = await git(['diff', '--cached', '--name-only'])
  if (staged.split('\n').some((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example'))) {
    throw new DeployError('Un fichier .env est sur le point d’être envoyé sur GitHub : arrêt. Vérifie .gitignore.')
  }
  await git(['commit', '-q', '-m', 'Mise en ligne']).catch(() => undefined) // rien à enregistrer : on continue
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
  await git(['push', '-q', `https://github.com/${fullName}.git`, 'HEAD:refs/heads/main'], {
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
  }).catch((error: Error & { stderr?: string }) => {
    throw new DeployError(`Envoi sur GitHub impossible : ${(error.stderr || error.message).replace(basic, '***').slice(0, 300)}`)
  })
}

/** Paire de clés SSH dédiée : la publique devient une clé de déploiement EN LECTURE SEULE du dépôt,
 *  la privée est confiée à Coolify pour qu'il puisse récupérer le code. */
export async function createDeployKey(token: string, fullName: string, title: string): Promise<{ privateKey: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deploy-key-'))
  const file = path.join(dir, 'id_ed25519')
  try {
    await run('ssh-keygen', ['-t', 'ed25519', '-N', '', '-C', title, '-f', file, '-q'])
    const [privateKey, publicKey] = await Promise.all([fs.readFile(file, 'utf8'), fs.readFile(`${file}.pub`, 'utf8')])
    await callJson('GitHub', `${API}/repos/${fullName}/keys`, token, { method: 'POST', body: { title, key: publicKey.trim(), read_only: true } })
    return { privateKey }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new DeployError('ssh-keygen introuvable sur cet ordinateur (installe OpenSSH).')
    throw error
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}
