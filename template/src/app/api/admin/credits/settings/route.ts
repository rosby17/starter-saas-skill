import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { forgetFreeWindow, parseFreeWindow, parseNudge, parseWelcome } from '@/lib/credits/settings'

export const dynamic = 'force-dynamic'

const KEYS = ['recharge_nudge', 'welcome_credits', 'free_window'] as const
const PARSE = { recharge_nudge: parseNudge, welcome_credits: parseWelcome, free_window: parseFreeWindow }

// Réglages des crédits (Administration › Crédits) : crédits de bienvenue, seuil du solde faible, fenêtre de gratuité.
// GET : réglages en place (pré-remplis à l'écran), services déjà facturés (pour la gratuité) et suivi de la recharge.
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const db = serviceClient()
  const [{ data: rows }, { data: debits }, { data: stats }] = await Promise.all([
    db.from('system_settings').select('key, value').in('key', [...KEYS]),
    // Services = « raison » passée à debitCredits() : on propose ceux réellement facturés ces 90 derniers jours.
    db.from('credits').select('source').lt('amount', 0).not('source', 'in', '(expiry,admin_adjustment)')
      .gte('created_at', new Date(Date.now() - 90 * 86_400_000).toISOString()).order('created_at', { ascending: false }).limit(1000),
    db.rpc('admin_recharge_nudge_stats', { p_days: 30 }),
  ])
  const value = (k: (typeof KEYS)[number]) => PARSE[k]((rows ?? []).find((r) => r.key === k)?.value)
  return NextResponse.json({
    success: true,
    settings: { recharge_nudge: value('recharge_nudge'), welcome_credits: value('welcome_credits'), free_window: value('free_window') },
    services: [...new Set((debits ?? []).map((d) => d.source as string))].sort(),
    stats: stats ?? null,
  })
}

const schema = z.object({ key: z.enum(KEYS), value: z.record(z.string(), z.unknown()) })

// PUT { key, value } : la valeur est normalisée (bornes, formats) avant d'être enregistrée.
export async function PUT(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Réglage invalide.' }, { status: 400 })
  const { key } = parsed.data
  const value = PARSE[key](parsed.data.value)
  const free = key === 'free_window' ? parseFreeWindow(parsed.data.value) : null
  if (free?.until && !free.services.length) {
    return NextResponse.json({ success: false, message: 'Choisis au moins un service à rendre gratuit.' }, { status: 400 })
  }
  const db = serviceClient()
  const { error } = await db.from('system_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 500 })
  if (key === 'free_window') forgetFreeWindow()
  await logAdminAction(db, auth.userId, `settings.${key}`, { type: 'setting', id: key }, value as Record<string, unknown>)
  return NextResponse.json({ success: true, message: 'Réglage enregistré.', value })
}
