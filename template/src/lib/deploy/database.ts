import { promises as fs } from 'fs'
import path from 'path'
import { callJson, DeployError } from './http'

// BASE DE DONNÉES : Supabase open source, hébergé par le créateur (Docker en local, service Coolify en ligne).
// Aucun compte supabase.com. Les requêtes SQL passent par la route sécurisée /pg/ de Supabase (pg-meta),
// réservée à la clé service : même code en local et sur le serveur.

export type Db = { url: string; serviceKey: string }

const q = (value: string) => `'${value.replace(/'/g, "''")}'`

export function pgQuery<T = Record<string, unknown>>(db: Db, query: string): Promise<T[]> {
  return callJson<T[]>('Base de données', `${db.url.replace(/\/+$/, '')}/pg/query`, db.serviceKey, {
    method: 'POST',
    body: { query },
    headers: { apikey: db.serviceKey },
  })
}

/** Attend que la base réponde (premier démarrage sur le serveur : quelques minutes, plus la propagation du domaine). */
export async function waitForDatabase(db: Db, timeoutMs: number): Promise<void> {
  const end = Date.now() + timeoutMs
  let last = ''
  while (Date.now() < end) {
    try {
      await pgQuery(db, 'select 1')
      return
    } catch (error) {
      last = (error as Error).message
    }
    await new Promise((r) => setTimeout(r, 15_000))
  }
  throw new DeployError(`La base ${db.url} ne répond pas encore (${last}). Le domaine met parfois du temps à se propager : relance dans quelques minutes.`)
}

/** Applique, dans l'ordre, les migrations de supabase/migrations pas encore passées.
 *  Elles sont notées dans supabase_migrations.schema_migrations, comme le fait le CLI Supabase. */
export async function applyMigrations(db: Db): Promise<string[]> {
  const dir = path.join(process.cwd(), 'supabase', 'migrations')
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  await pgQuery(db, `create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`)
  const applied = new Set((await pgQuery<{ version: string }>(db, 'select version from supabase_migrations.schema_migrations')).map((r) => r.version))
  const ran: string[] = []
  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, '').split('_')
    if (applied.has(version)) continue
    const sql = await fs.readFile(path.join(dir, file), 'utf8')
    try {
      await pgQuery(db, sql)
    } catch (error) {
      throw new DeployError(`Migration ${file} en échec : ${(error as Error).message}`)
    }
    await pgQuery(db, `insert into supabase_migrations.schema_migrations (version, name) values (${q(version)}, ${q(rest.join('_'))}) on conflict do nothing`)
    ran.push(file)
  }
  return ran
}

/** Recopie les comptes administrateurs (même adresse, même mot de passe) d'une base à l'autre. */
export async function copyAdmins(from: Db, to: Db): Promise<number> {
  const admins = await pgQuery<{ id: string; email: string; encrypted_password: string }>(from,
    `select u.id, u.email, u.encrypted_password from auth.users u join public.profiles p on p.id = u.id where p.is_admin and u.email is not null`)
  for (const a of admins) {
    if (!/^[0-9a-f-]{36}$/.test(a.id)) continue
    await callJson('Base de données', `${to.url.replace(/\/+$/, '')}/auth/v1/admin/users`, to.serviceKey, {
      method: 'POST',
      headers: { apikey: to.serviceKey },
      // Mot de passe provisoire aléatoire : remplacé juste après par l'empreinte du mot de passe local.
      body: { id: a.id, email: a.email, email_confirm: true, password: crypto.randomUUID() + crypto.randomUUID() },
      okStatuses: [422], // déjà présent : on met seulement à jour
    })
    await pgQuery(to, `update auth.users set encrypted_password = ${q(a.encrypted_password)} where id = ${q(a.id)}`)
    // Le profil est créé par le déclencheur handle_new_user.
    await pgQuery(to, `insert into public.profiles (id, is_admin) values (${q(a.id)}, true) on conflict (id) do update set is_admin = true`)
  }
  return admins.length
}

/** Recopie des lignes (réglages, clés chiffrées) ; par défaut sans écraser celles qui existent déjà en ligne. */
export async function copyRows(to: Db, table: 'system_settings' | 'app_secrets', rows: Array<Record<string, unknown>>, key: string, overwrite = false): Promise<void> {
  for (const row of rows) {
    const cols = Object.keys(row)
    const values = cols.map((c) => {
      const v = row[c]
      if (v === null || v === undefined) return 'null'
      return typeof v === 'object' ? `${q(JSON.stringify(v))}::jsonb` : q(String(v))
    })
    await pgQuery(to, `insert into public.${table} (${cols.join(', ')}) values (${values.join(', ')}) on conflict (${key}) ${overwrite ? `do update set ${cols.filter((c) => c !== key).map((c) => `${c} = excluded.${c}`).join(', ')}` : 'do nothing'}`)
  }
}
