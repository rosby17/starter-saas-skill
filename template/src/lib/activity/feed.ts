import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { TZ_OFFSET_MS } from '@/lib/time'
import { feedStatus, type ActivitySource, type ActivityStatus, type FeedItem, type FeedUser } from './types'

// Lecture du fil d'activité (table activity_events). Les étapes d'une action longue (parent_id)
// sont rangées sous leur ligne mère ; le texte long n'est PAS chargé ici (seulement un aperçu) :
// il se lit à l'ouverture de la ligne (GET /api/admin/activity/item).

/** Lignes lues au plus pour une fenêtre (la journée d'un petit SaaS tient largement dedans). */
export const MAX_ROWS = 3000
const PREVIEW = 160

type Row = {
  id: string
  created_at: string
  finished_at: string | null
  user_id: string | null
  action: string
  label: string
  source: ActivitySource
  status: ActivityStatus
  amount: number | null
  currency: string | null
  detail: string | null
  error: string | null
  metadata: Record<string, unknown> | null
  parent_id: string | null
  ref_table: string | null
  ref_id: string | null
}

/** Minuit (heure de site.timezone) il y a `daysBack` jours. */
export function startOfLocalDay(now: number, daysBack = 0): Date {
  const local = new Date(now + TZ_OFFSET_MS)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - TZ_OFFSET_MS - daysBack * 86_400_000)
}

function toItem(row: Row, now: number): FeedItem {
  const finished = row.finished_at ? new Date(row.finished_at).getTime() : null
  return {
    id: row.id,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    durationMs: finished ? Math.max(0, finished - new Date(row.created_at).getTime()) : null,
    userId: row.user_id,
    action: row.action,
    label: row.label,
    source: row.source,
    status: feedStatus(row.status, row.created_at, now),
    amount: row.amount === null ? null : Number(row.amount),
    currency: row.currency,
    error: row.error,
    hasDetail: Boolean(row.detail) || Object.keys(row.metadata ?? {}).length > 0,
    preview: row.detail ? row.detail.replace(/\s+/g, ' ').slice(0, PREVIEW) : null,
    test: row.metadata?.test === true,
    ref: row.ref_table && row.ref_id ? { table: row.ref_table, id: row.ref_id } : null,
    steps: [],
  }
}

/** Actions depuis `since`, la plus récente d'abord, étapes rangées sous leur action. */
export async function loadActivity(db: SupabaseClient, since: string, now = Date.now()): Promise<{ items: FeedItem[]; truncated: boolean }> {
  const { data, error } = await db.from('activity_events')
    .select('id, created_at, finished_at, user_id, action, label, source, status, amount, currency, detail, error, metadata, parent_id, ref_table, ref_id')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS + 1)
  if (error) throw new Error(`fil d'activité illisible : ${error.message}`)
  const rows = (data ?? []) as Row[]
  const truncated = rows.length > MAX_ROWS
  const items = new Map<string, FeedItem>()
  const steps: FeedItem[] = []
  for (const row of rows.slice(0, MAX_ROWS)) {
    const item = toItem(row, now)
    if (row.parent_id) steps.push(Object.assign(item, { parentId: row.parent_id }))
    else items.set(row.id, item)
  }
  for (const step of steps as Array<FeedItem & { parentId: string }>) {
    const parent = items.get(step.parentId)
    // Étape dont l'action mère est plus ancienne que la fenêtre : affichée seule.
    if (parent) parent.steps.unshift(step)
    else items.set(step.id, step)
  }
  return { items: [...items.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), truncated }
}

/** Nom et e-mail des clients affichés (jamais envoyés ailleurs que dans l'admin). */
export async function loadFeedUsers(db: SupabaseClient, ids: string[]): Promise<Record<string, FeedUser>> {
  const unique = [...new Set(ids)]
  const users: Record<string, FeedUser> = {}
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await db.from('profiles').select('id, first_name, full_name, username, email').in('id', unique.slice(i, i + 200))
    if (error) throw new Error(`profils illisibles : ${error.message}`)
    for (const p of data ?? []) users[p.id] = { name: p.full_name || p.first_name || p.username || null, email: p.email ?? null }
  }
  return users
}
