import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { groupProblems, type ProblemRow } from '@/lib/monitoring/problems'
import { explainError } from '@/lib/monitoring/explain-error'
import { autoResolveStaleErrors } from '@/lib/monitoring/auto-resolve'

// Période par défaut : 24 h (un journal qui s'allonge avec le temps fait croire à plus d'erreurs qu'il n'y en a).
const PERIODS: Record<string, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }
const MAX_ROWS = 5000

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.authorized) return admin.error
  try {
    await autoResolveStaleErrors()
    const params = new URL(request.url).searchParams
    const hours = PERIODS[params.get('period') || ''] ?? 24
    const source = params.get('source') || 'all'
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
    const { data, error } = await serviceClient().from('error_logs').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(MAX_ROWS)
    if (error) throw error
    const rows = (data || []) as (ProblemRow & { resolved_at: string | null })[]
    const open = rows.filter((row) => !row.resolved_at && (source === 'all' || row.source === source))
    const problems = groupProblems(open)
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
  const { error } = await serviceClient().from('error_logs').update(resolved ? { resolved_at: new Date().toISOString(), resolved_by: admin.userId } : { resolved_at: null, resolved_by: null }).in('id', ids)
  if (error) return NextResponse.json({ success: false, message: 'Mise à jour impossible.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
