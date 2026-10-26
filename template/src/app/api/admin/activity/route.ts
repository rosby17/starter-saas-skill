import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { loadActivity, loadFeedUsers, startOfLocalDay } from '@/lib/activity/feed'
import { summarize, type FeedItem } from '@/lib/activity/types'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000
const PERIODS: Record<string, number> = { jour: 0, hier: 1, semaine: 6 }

/**
 * Fil d'activité : chaque action de la période (aujourd'hui par défaut, heure de site.timezone), réussie,
 * échouée, en cours ou bloquée, avec sa source et son client ; synthèse de toute la période.
 * Paramètres : periode (jour | hier | semaine), status, source, action, user, limit.
 * La page se rafraîchit toutes les 20 s.
 */
export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const params = new URL(request.url).searchParams
  const now = Date.now()
  const period = params.get('periode') ?? 'jour'
  const since = startOfLocalDay(now, PERIODS[period] ?? 0).toISOString()
  try {
    const db = serviceClient()
    const { items, truncated } = await loadActivity(db, since, now)
    const status = params.get('status')
    const source = params.get('source')
    const action = params.get('action')
    const user = params.get('user')
    const matches = (item: FeedItem) =>
      (!status || (status === 'problemes' ? ['failed', 'stuck'].includes(item.status) : item.status === status)) &&
      (!source || item.source === source) &&
      (!action || item.action === action) &&
      (!user || item.userId === user)
    const filtered = items.filter(matches)
    const requested = Number(params.get('limit'))
    const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT
    const page = filtered.slice(0, limit)
    const ids = page.flatMap((item) => [item.userId, ...item.steps.map((s) => s.userId)]).filter((id): id is string => Boolean(id))
    return NextResponse.json({
      success: true,
      generatedAt: new Date(now).toISOString(),
      since,
      matching: filtered.length,
      truncated,
      items: page,
      users: await loadFeedUsers(db, ids),
      summary: summarize(items),
    })
  } catch (error) {
    console.error('[activité]', error)
    return NextResponse.json({ success: false, message: 'Fil illisible (migration 20261026110000_fil_activite appliquée ?).' }, { status: 500 })
  }
}
