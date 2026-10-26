import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { groupProblems, problemKey, type ProblemRow } from '@/lib/monitoring/problems'
import { explainError } from '@/lib/monitoring/explain-error'
import { autoResolveStaleErrors } from '@/lib/monitoring/auto-resolve'
import { maskProviders } from '@/lib/engines/codenames'

// Période par défaut : 24 h (un journal qui s'allonge avec le temps fait croire à plus d'erreurs qu'il n'y en a).
const PERIODS: Record<string, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }
const MAX_ROWS = 5000
const MAX_OCCURRENCES = 50

type Row = ProblemRow & { resolved_at: string | null; reference: string; page: string | null; user_agent: string | null }

// Les noms des fournisseurs ne s'affichent jamais en clair : une capture d'écran ne doit pas les révéler.
const masked = <T extends { cause: string; fix: string; clientMessage: string | null }>(p: T): T =>
  ({ ...p, cause: maskProviders(p.cause), fix: maskProviders(p.fix), clientMessage: maskProviders(p.clientMessage) })

// GET : problèmes regroupés de la période. Avec ?problem=<clé> : les occurrences de CE problème (dépliées sous sa carte).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.authorized) return admin.error
  try {
    await autoResolveStaleErrors()
    const params = new URL(request.url).searchParams
    const hours = PERIODS[params.get('period') || ''] ?? 24
    const source = params.get('source') || 'all'
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
    const db = serviceClient()
    const { data, error } = await db.from('error_logs').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(MAX_ROWS)
    if (error) throw error
    const rows = (data || []) as Row[]
    const open = rows.filter((row) => !row.resolved_at && (source === 'all' || row.source === source))

    const wanted = params.get('problem')
    if (wanted) {
      const matching = open.filter((row) => problemKey(explainError(row)) === wanted)
      const shown = matching.slice(0, MAX_OCCURRENCES)
      const userIds = [...new Set(shown.map((row) => row.user_id).filter((id): id is string => !!id))]
      const emails = new Map<string, string>()
      if (userIds.length) {
        const { data: profiles } = await db.from('profiles').select('id, email').in('id', userIds)
        for (const p of (profiles || []) as { id: string; email: string | null }[]) if (p.email) emails.set(p.id, p.email)
      }
      return NextResponse.json({
        success: true,
        total: matching.length,
        logs: shown.map((row) => ({
          id: row.id,
          reference: row.reference,
          created_at: row.created_at,
          source: row.source,
          action: row.action,
          page: row.page,
          http_status: row.http_status,
          error_message: maskProviders(row.error_message),
          details: row.details,
          user_id: row.user_id,
          user_email: row.user_id ? emails.get(row.user_id) ?? null : null,
          user_agent: row.user_agent,
        })),
      })
    }

    const problems = groupProblems(open).map(masked)
    return NextResponse.json({
      success: true,
      problems,
      counts: {
        todo: problems.filter((p) => p.severity !== 'low').length,
        resolved: rows.filter((row) => row.resolved_at).length,
        client: open.filter((row) => explainError(row).severity === 'low').length,
      },
    })
  } catch (error) {
    console.error('[admin errors] GET', error)
    return NextResponse.json({ success: false, message: 'Erreur interne' }, { status: 500 })
  }
}

// Marque des erreurs comme résolues (ou les rouvre).
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.authorized) return admin.error
  const body = (await request.json().catch(() => null)) as { ids?: unknown; resolved?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === 'string').slice(0, 500) : []
  if (!ids.length) return NextResponse.json({ success: false, message: 'Aucune erreur choisie.' }, { status: 400 })
  const resolved = body?.resolved !== false
  const { error } = await serviceClient().from('error_logs')
    .update(resolved ? { resolved_at: new Date().toISOString(), resolved_by: admin.userId, resolution_note: 'Marquée résolue à la main.' } : { resolved_at: null, resolved_by: null, resolution_note: null })
    .in('id', ids)
  if (error) return NextResponse.json({ success: false, message: 'Mise à jour impossible.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
