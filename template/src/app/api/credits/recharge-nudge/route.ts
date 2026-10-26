import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { getCreditsBalance } from '@/lib/credits/balance'
import { parseNudge, readSetting } from '@/lib/credits/settings'
import { recommendPack } from '@/lib/credits/recommend'
import { hasModule } from '@/config/site'

export const dynamic = 'force-dynamic'

const DAY_MS = 86_400_000
/** Un même bandeau n'est compté « affiché » qu'une fois toutes les 6 h (sinon chaque page vue gonfle le chiffre). */
const SHOWN_DEDUPE_MS = 6 * 3_600_000

async function currentUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Proposition de recharge au solde faible : solde, seuil, pause en cours (« Plus tard ») et pack recommandé pour
 * le client connecté (son pack habituel, sinon selon sa consommation, sinon le plus petit).
 */
export async function GET() {
  if (!hasModule('credits')) return NextResponse.json({ success: false }, { status: 404 })
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ success: false }, { status: 401 })
  const db = serviceClient()
  const now = Date.now()
  try {
    const [balance, setting, { data: dismissed }, { data: packs }, { data: orders }, { data: spent }] = await Promise.all([
      getCreditsBalance(db, userId),
      readSetting(db, 'recharge_nudge').catch(() => null),
      db.from('recharge_nudge_events').select('created_at').eq('user_id', userId).eq('event', 'dismissed').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('products').select('slug, title, credits').eq('category', 'credits').eq('published', true).order('position'),
      db.from('orders').select('credits, created_at, products(slug)').eq('user_id', userId).eq('status', 'success').gt('credits', 0)
        .gte('created_at', new Date(now - 365 * DAY_MS).toISOString()).order('created_at', { ascending: false }).limit(20),
      db.from('credits').select('amount').eq('user_id', userId).lt('amount', 0).not('source', 'in', '(expiry,admin_adjustment)')
        .gte('created_at', new Date(now - 30 * DAY_MS).toISOString()).limit(1000),
    ])
    const { threshold, snoozeDays } = parseNudge(setting)
    const until = dismissed ? Date.parse(dismissed.created_at) + snoozeDays * DAY_MS : 0
    const paidOrders = (orders ?? []).map((o) => {
      const p = (Array.isArray(o.products) ? o.products[0] : o.products) as { slug?: string } | null
      return { credits: Number(o.credits) || 0, productSlug: p?.slug ?? null, at: o.created_at as string }
    })
    const spent30d = (spent ?? []).reduce((sum, r) => sum + Math.abs(Number(r.amount) || 0), 0)
    // Une recommandation ratée ne doit jamais empêcher le bandeau : au pire, aucun pack mis en avant.
    const recommendation = recommendPack({ paidOrders, spent30d }, (packs ?? []).map((p) => ({ slug: p.slug as string, credits: Number(p.credits) || 0 })))
    const pack = recommendation ? (packs ?? []).find((p) => p.slug === recommendation.pack) : null
    return NextResponse.json({
      success: true, balance, threshold,
      snoozedUntil: until > now ? new Date(until).toISOString() : null,
      recommendation: recommendation && pack ? { ...recommendation, title: pack.title, credits: pack.credits } : null,
    })
  } catch (error) {
    console.error('Proposition de recharge :', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

const eventSchema = z.object({
  event: z.enum(['shown', 'dismissed', 'clicked']),
  placement: z.enum(['banner', 'credits_page']).nullish(),
  pack: z.string().max(80).regex(/^[a-z0-9-]+$/).nullish(),
})

/** Suivi de conversion : affiché, refusé (« Plus tard »), cliqué. Le paiement est rapproché à la lecture (admin). */
export async function POST(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ success: false }, { status: 401 })
  const input = eventSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({ success: false }, { status: 400 })
  const db = serviceClient()
  const { event, placement, pack } = input.data
  if (event === 'shown') {
    const { data: recent } = await db.from('recharge_nudge_events').select('id').eq('user_id', userId).eq('event', 'shown')
      .gte('created_at', new Date(Date.now() - SHOWN_DEDUPE_MS).toISOString()).limit(1).maybeSingle()
    if (recent) return NextResponse.json({ success: true, deduped: true })
  }
  const { error } = await db.from('recharge_nudge_events').insert({ user_id: userId, event, placement: placement ?? null, pack: pack ?? null })
  // Table absente tant que la migration n'est pas passée : le suivi ne doit jamais gêner le client.
  if (error) console.error('Suivi de la recharge :', error.message)
  return NextResponse.json({ success: !error })
}
