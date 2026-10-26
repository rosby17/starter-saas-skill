// Fil d'activité : types et libellés partagés par le serveur et l'écran d'administration (aucune lecture ici).

export type ActivityStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'
export type ActivitySource = 'site' | 'api' | 'admin' | 'paiement' | 'systeme'

/** Statut affiché : « bloquée » = encore en cours au-delà de STUCK_AFTER_MS. */
export type FeedStatus = ActivityStatus | 'stuck'

export const STATUS_LABELS: Record<FeedStatus, string> = {
  running: 'En cours',
  stuck: 'Bloquée',
  succeeded: 'Réussie',
  failed: 'Échec',
  cancelled: 'Annulée',
}

export const SOURCE_LABELS: Record<ActivitySource, string> = {
  site: 'Site',
  api: 'API',
  admin: 'Admin',
  paiement: 'Paiement',
  systeme: 'Système',
}

/** Familles d'actions connues (le reste s'affiche avec sa clé). Ajouter ici chaque nouvelle action notée. */
export const ACTION_LABELS: Record<string, string> = {
  'compte.inscription': 'Inscriptions',
  commande: 'Commandes',
  'demande.nouvelle': 'Demandes',
  'compte.inscription_echec': 'Inscriptions échouées',
}

/** Une commande en attente depuis plus longtemps est montrée « bloquée » (le cron l'annule à 30 min). */
export const STUCK_AFTER_MS = 30 * 60 * 1000

export type FeedItem = {
  id: string
  createdAt: string
  finishedAt: string | null
  durationMs: number | null
  userId: string | null
  action: string
  label: string
  source: ActivitySource
  status: FeedStatus
  amount: number | null
  currency: string | null
  error: string | null
  /** true : un texte long est lisible en ouvrant la ligne. */
  hasDetail: boolean
  /** Aperçu du texte long (début). */
  preview: string | null
  test: boolean
  ref: { table: string; id: string } | null
  /** Étapes d'une action longue (ligne dépliable). */
  steps: FeedItem[]
}

export type FeedUser = { name: string | null; email: string | null }

export type FeedSummary = {
  total: number
  byStatus: Record<FeedStatus, number>
  /** Part des actions terminées qui ont réussi (null : rien de terminé). */
  successRate: number | null
  activeUsers: number
  /** Chiffre encaissé dans la journée (commandes payées, hors tests), par devise. */
  revenue: Record<string, number>
  byAction: { action: string; label: string; count: number; failed: number }[]
}

export type FeedDetail = {
  detail: string | null
  error: string | null
  metadata: Record<string, unknown>
  /** Lien vers la fiche de l'objet dans l'administration. */
  href: string | null
}

export function feedStatus(status: ActivityStatus, createdAt: string, now: number): FeedStatus {
  if (status === 'running' && now - new Date(createdAt).getTime() > STUCK_AFTER_MS) return 'stuck'
  return status
}

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action

/** Fiche d'administration reliée à une ligne du fil : l'objet s'il a sa page, sinon la fiche du client. */
export function refHref(ref: { table: string; id: string } | null, userId: string | null): string | null {
  if (ref?.table === 'service_requests') return `/admin/requests/${encodeURIComponent(ref.id)}`
  if (userId) return `/admin/customers/${encodeURIComponent(userId)}`
  return null
}

export function summarize(items: FeedItem[]): FeedSummary {
  const byStatus: Record<FeedStatus, number> = { running: 0, stuck: 0, succeeded: 0, failed: 0, cancelled: 0 }
  const users = new Set<string>()
  const revenue: Record<string, number> = {}
  const actions = new Map<string, { count: number; failed: number }>()
  for (const item of items) {
    byStatus[item.status] += 1
    if (item.userId) users.add(item.userId)
    if (item.action === 'commande' && item.status === 'succeeded' && !item.test && item.amount) {
      const currency = item.currency || 'XOF'
      revenue[currency] = (revenue[currency] ?? 0) + Number(item.amount)
    }
    const entry = actions.get(item.action) ?? { count: 0, failed: 0 }
    entry.count += 1
    if (item.status === 'failed' || item.status === 'stuck') entry.failed += 1
    actions.set(item.action, entry)
  }
  const finished = byStatus.succeeded + byStatus.failed + byStatus.stuck
  return {
    total: items.length,
    byStatus,
    successRate: finished ? byStatus.succeeded / finished : null,
    activeUsers: users.size,
    revenue,
    byAction: [...actions.entries()].map(([action, v]) => ({ action, label: actionLabel(action), ...v })).sort((a, b) => b.count - a.count),
  }
}
