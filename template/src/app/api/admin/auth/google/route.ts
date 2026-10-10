import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { coolify } from '@/lib/deploy/coolify'
import { getDeploySettings, saveDeploySettings } from '@/lib/deploy/runner'
import { googleEnabled } from '@/lib/auth/providers'

// État actuel : ce que dit le service de connexion lui-même, et si les clés sont collées.
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  return NextResponse.json({ success: true, active: await googleEnabled(), configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), coolify: !!(process.env.COOLIFY_URL && process.env.COOLIFY_API_TOKEN) })
}

// Activer / désactiver la connexion avec Google : transmet GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (Clés et intégrations)
// au service de connexion de la base (GoTrue, service Supabase dans Coolify), puis le redémarre (≈ 1 minute).
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const parsed = z.object({ enabled: z.boolean() }).safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false }, { status: 400 })
  const { enabled } = parsed.data
  const id = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET
  if (enabled && (!id || !secret)) return NextResponse.json({ success: false, message: 'Colle d’abord l’ID client et le code secret Google dans Clés et intégrations.' }, { status: 400 })
  const url = process.env.COOLIFY_URL, token = process.env.COOLIFY_API_TOKEN
  if (!url || !token) return NextResponse.json({ success: false, message: 'Il manque l’adresse de Coolify (ex. https://coolify.mondomaine.com) ou son jeton API dans Clés et intégrations → Mise en ligne.' }, { status: 400 })
  const apiUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  try {
    const cf = coolify(url, token)
    // Le service Supabase : celui déjà connu, sinon celui dont la configuration contient l'adresse de la base.
    let settings = await getDeploySettings()
    let uuid = settings.supabaseUuid
    if (!uuid) {
      const host = apiUrl.replace(/^https?:\/\//, '')
      const bases = (await cf.listServices()).filter((s) => JSON.stringify(s).includes('GOTRUE'))
      const found = bases.find((s) => JSON.stringify(s).includes(host)) ?? (bases.length === 1 ? bases[0] : undefined)
      if (!found) return NextResponse.json({ success: false, message: `Service de la base introuvable dans Coolify (${host}).` }, { status: 404 })
      uuid = found.uuid
      settings = await saveDeploySettings({ supabaseUuid: uuid })
    }
    if (enabled) await cf.enableGoogleAuth(uuid)
    await cf.setServiceEnvs(uuid, enabled
      ? { GOTRUE_EXTERNAL_GOOGLE_ENABLED: 'true', GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: id!, GOTRUE_EXTERNAL_GOOGLE_SECRET: secret!, GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: `${apiUrl}/auth/v1/callback` }
      : { GOTRUE_EXTERNAL_GOOGLE_ENABLED: 'false' })
    await cf.restartService(uuid)
    const db = serviceClient()
    await db.from('system_settings').upsert({ key: 'google_login', value: { enabled }, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    await logAdminAction(db, auth.userId, enabled ? 'auth.google_on' : 'auth.google_off', { type: 'settings', id: 'google' })
    return NextResponse.json({ success: true, message: enabled ? 'Connexion Google activée : le service de connexion redémarre (environ 1 minute).' : 'Connexion Google désactivée.' })
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message || 'Coolify ne répond pas.' }, { status: 502 })
  }
}
