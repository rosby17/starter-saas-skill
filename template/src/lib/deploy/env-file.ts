import { promises as fs } from 'fs'
import path from 'path'

// Écrit des variables dans .env.local (poste local uniquement) : l'utilisateur n'ouvre jamais ce fichier.
// Next.js recharge .env.local tout seul en développement ; on met aussi process.env à jour tout de suite.
export async function writeEnvLocal(values: Record<string, string>): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('.env.local ne s’écrit qu’en local.')
  const file = path.join(process.cwd(), '.env.local')
  let content = ''
  try { content = await fs.readFile(file, 'utf8') } catch { /* fichier absent : créé ci-dessous */ }
  const lines = content.split('\n')
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Z0-9_]+$/.test(key) || /[\r\n]/.test(value)) throw new Error(`Variable invalide : ${key}`)
    const line = `${key}=${value}`
    const i = lines.findIndex((l) => l.replace(/^#\s*/, '').startsWith(`${key}=`))
    if (i >= 0) lines[i] = line
    else lines.push(line)
    process.env[key] = value
  }
  await fs.writeFile(file, lines.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 })
}
