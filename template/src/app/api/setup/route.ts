import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isPlaceholder } from '@/lib/secrets/catalog'
import { applyStoredSecrets, saveSecret } from '@/lib/secrets/store'
import { writeEnvLocal } from '@/lib/deploy/env-file'
import { DeployError } from '@/lib/deploy/http'
import { applyMigrations } from '@/lib/deploy/database'
import { dockerRunning, localStatus, startLocal } from '@/lib/deploy/local-supabase'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 600

// ASSISTANT DE DÉMARRAGE (/setup) : sur l'ordinateur du créateur uniquement, avant que le site ait un administrateur.
// La base est un Supabase open source dans Docker (aucun compte à créer) ; en ligne, /admin/deploy l'installe sur le serveur.
// Protégé par SETUP_TOKEN (écrit dans .env.local par le script de création), et fermé pour toujours ensuite.

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

export async function GET() {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ success: false }, { status: 404 })
  return NextResponse.json({ success: true, supabaseReady: supabaseReady() && !!(await localStatus()), docker: await dockerRunning(), done: await hasAdmin(), tokenConfigured: !!process.env.SETUP_TOKEN })
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ success: false }, { status: 404 })
  if (!checkRateLimit('setup', 30, 60_000).success) return NextResponse.json({ success: false, message: 'Trop de tentatives.' }, { status: 429 })
  const body = await request.json().catch(() => ({}))
  if (!tokenOk(body.token)) return NextResponse.json({ success: false, message: 'Lien d’installation invalide : rouvre celui donné par Claude.' }, { status: 403 })
  if (await hasAdmin()) return NextResponse.json({ success: false, message: 'Installation déjà terminée : connecte-toi.' }, { status: 409 })

  try {
    switch (body.action) {
      case 'database': {
        const migrations = await connectLocal()
        return NextResponse.json({ success: true, migrations })
      }
      case 'admin': {
        if (!supabaseReady()) throw new DeployError('Démarre d’abord la base de données.')
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
        const password = typeof body.password === 'string' ? body.password : ''
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DeployError('Adresse e-mail invalide.')
        if (password.length < 10) throw new DeployError('Mot de passe : 10 caractères au minimum.')
        const db = admin()
        const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
        if (error || !data.user) throw new DeployError(`Compte non créé : ${error?.message || 'erreur inconnue'}`)
        // Le profil est créé par le déclencheur handle_new_user ; on attend qu'il existe pour le passer administrateur.
        for (let i = 0; i < 10; i++) {
          const { data: rows } = await db.from('profiles').update({ is_admin: true }).eq('id', data.user.id).select('id')
          if (rows?.length) return NextResponse.json({ success: true })
          await new Promise((r) => setTimeout(r, 500))
        }
        throw new DeployError('Compte créé mais profil introuvable : vérifie que les migrations sont passées.')
      }
      default:
        throw new DeployError('Action inconnue.')
    }
  } catch (error) {
    const status = error instanceof DeployError ? error.status : 500
    if (!(error instanceof DeployError)) console.error('Assistant de démarrage :', error)
    return NextResponse.json({ success: false, message: (error as Error).message }, { status })
  }
}
