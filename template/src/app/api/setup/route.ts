import { timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as sessionClient } from '@/lib/supabase/server'
import { isPlaceholder } from '@/lib/secrets/catalog'
import { applyStoredSecrets } from '@/lib/secrets/store'
import { writeEnvLocal } from '@/lib/deploy/env-file'
import { DeployError } from '@/lib/deploy/http'
import { applyMigrations } from '@/lib/deploy/database'
import { dockerRunning, localStatus, startLocal } from '@/lib/deploy/local-supabase'
import { googleEnabled } from '@/lib/auth/providers'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 600

// ASSISTANT D'INSTALLATION (/setup), tant que le site n'a pas d'administrateur, puis fermé pour toujours.
// - Sur l'ordinateur du créateur : démarre la base (Supabase open source dans Docker), puis crée le compte admin.
// - En ligne : la base existe déjà (installée par la mise en ligne) ; il ne reste que le compte admin.
// Protégé par SETUP_TOKEN : le lien d'installation (?token=…) le dépose dans un cookie HttpOnly, valable 24 h,
// pour que l'installation survive à un rechargement ou à un nouvel onglet.

const COOKIE = 'setup_token'
const online = () => process.env.NODE_ENV === 'production'
const supabaseReady = () => !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL) && !isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY)
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

async function hasAdmin(): Promise<boolean> {
  if (!supabaseReady()) return false
  const { count, error } = await admin().from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', true)
  return !error && (count ?? 0) > 0
}

function tokenOk(provided: unknown): boolean {
  const expected = process.env.SETUP_TOKEN
  if (!expected || typeof provided !== 'string') return false
  const a = Buffer.from(provided), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Clic fait depuis le navigateur de CET ordinateur : le serveur de développement n'écoute que sur localhost
// (script « dev » : -H localhost), l'hôte doit être local (contre le DNS rebinding) et l'origine identique (contre un autre site).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
function sameMachine(request: Request): boolean {
  const host = request.headers.get('host')
  const origin = request.headers.get('origin')
  if (!host || !origin) return false
  try {
    const url = new URL(origin)
    return url.host === host && LOCAL_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

async function authorized(request: Request, bodyToken: unknown): Promise<boolean> {
  if (tokenOk(bodyToken) || tokenOk((await cookies()).get(COOKIE)?.value)) return true
  return !online() && sameMachine(request)
}

// Base locale (Docker) : démarre si besoin, écrit ses clés dans .env.local, crée les tables.
async function connectLocal() {
  const keys = (await localStatus()) || (await startLocal())
  await writeEnvLocal({
    NEXT_PUBLIC_SUPABASE_URL: keys.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: keys.serviceKey,
  })
  const migrations = await applyMigrations({ url: keys.url, serviceKey: keys.serviceKey })
  await applyStoredSecrets()
  return migrations
}

/** Passe le compte en administrateur (le profil est créé par le déclencheur handle_new_user : on l'attend). */
async function makeAdmin(userId: string) {
  const db = admin()
  for (let i = 0; i < 10; i++) {
    const { data: rows } = await db.from('profiles').update({ is_admin: true }).eq('id', userId).select('id')
    if (rows?.length) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new DeployError('Compte créé mais profil introuvable : vérifie que les tables ont bien été créées.')
}

function done(extra: Record<string, unknown> = {}) {
  const res = NextResponse.json({ success: true, ...extra })
  res.cookies.delete(COOKIE) // installation finie : le jeton ne sert plus
  return res
}

export async function GET() {
  if (online() && !process.env.SETUP_TOKEN) return NextResponse.json({ success: false }, { status: 404 })
  // En local, le serveur n'écoute que sur cet ordinateur : pas de lien à coller. En ligne : cookie posé par le lien.
  const unlocked = !online() || tokenOk((await cookies()).get(COOKIE)?.value)
  const ready = online() ? supabaseReady() : supabaseReady() && !!(await localStatus())
  return NextResponse.json({
    success: true,
    online: online(),
    supabaseReady: ready,
    docker: online() ? false : await dockerRunning(),
    done: await hasAdmin(),
    unlocked,
    google: ready ? await googleEnabled() : false,
  })
}

export async function POST(request: Request) {
  if (online() && !process.env.SETUP_TOKEN) return NextResponse.json({ success: false }, { status: 404 })
  if (!checkRateLimit('setup', 30, 60_000).success) return NextResponse.json({ success: false, message: 'Trop de tentatives. Réessaie dans une minute.' }, { status: 429 })
  const body = await request.json().catch(() => ({}))
  if (!(await authorized(request, body.token))) {
    return NextResponse.json({ success: false, code: 'locked', message: 'Ce lien d’installation n’est pas le bon. Ouvre le lien complet reçu à la fin de l’installation (il se termine par ?token=…).' }, { status: 403 })
  }

  // Ouvre l'installation : le jeton passe dans un cookie HttpOnly (jamais lisible par la page) pour 24 h.
  if (body.action === 'unlock') {
    const res = NextResponse.json({ success: true })
    if (tokenOk(body.token)) {
      res.cookies.set(COOKIE, body.token, { httpOnly: true, secure: online(), sameSite: 'strict', path: '/', maxAge: 24 * 3600 })
    }
    return res
  }

  if (await hasAdmin()) return NextResponse.json({ success: false, code: 'done', message: 'Installation déjà terminée : connecte-toi.' }, { status: 409 })

  try {
    switch (body.action) {
      case 'database': {
        if (online()) throw new DeployError('La base est déjà installée sur le serveur.')
        const migrations = await connectLocal()
        return NextResponse.json({ success: true, migrations })
      }
      case 'admin': {
        if (!supabaseReady()) throw new DeployError('Démarre d’abord la base de données.')
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
        const password = typeof body.password === 'string' ? body.password : ''
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new DeployError('Adresse e-mail invalide.')
        if (password.length < 10 || password.length > 200) throw new DeployError('Mot de passe : 10 caractères au minimum.')
        const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true })
        if (error || !data.user) {
          const exists = /already|registered|exists/i.test(error?.message || '')
          throw new DeployError(exists ? 'Cette adresse a déjà un compte : utilise « Continuer avec Google » si c’est ton compte Google, ou une autre adresse.' : 'Le compte n’a pas pu être créé. Réessaie dans un instant.')
        }
        await makeAdmin(data.user.id)
        return done()
      }
      case 'claim': {
        // Retour de « Continuer avec Google » : le compte connecté devient l'administrateur.
        const { data: { user } } = await (await sessionClient()).auth.getUser()
        if (!user) throw new DeployError('Connexion Google non aboutie : réessaie.', 401)
        await makeAdmin(user.id)
        return done()
      }
      default:
        throw new DeployError('Action inconnue.')
    }
  } catch (error) {
    const status = error instanceof DeployError ? error.status : 500
    if (!(error instanceof DeployError)) console.error('Assistant d’installation :', error)
    return NextResponse.json({ success: false, message: error instanceof DeployError ? error.message : 'Une erreur est survenue. Réessaie dans un instant.' }, { status })
  }
}
