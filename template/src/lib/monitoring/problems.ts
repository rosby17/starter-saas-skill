import { explainError, SEVERITY_ORDER, type ErrorExplanation, type ExplainableError } from '@/lib/monitoring/explain-error'

// Regroupe les erreurs ouvertes par fonctionnalité + cause en clair (pas par message brut), de la plus grave à la moins grave.
export type ProblemRow = ExplainableError & { id: string; user_id: string | null; created_at: string }

export type Problem = ErrorExplanation & {
  key: string
  ids: string[]
  count: number
  affectedUsers: number
  lastSeen: string
}

export function groupProblems(rows: ProblemRow[], limit = 30): Problem[] {
  const groups = new Map<string, ErrorExplanation & { count: number; users: Set<string>; ids: string[]; lastSeen: string }>()
  for (const row of rows) { // de la plus récente à la plus ancienne
    const explanation = explainError(row)
    const key = `${explanation.feature}::${explanation.cause}`
    const group = groups.get(key) || { ...explanation, count: 0, users: new Set<string>(), ids: [], lastSeen: row.created_at }
    group.count += 1
    if (row.user_id) group.users.add(row.user_id)
    if (group.ids.length < 500) group.ids.push(row.id)
    groups.set(key, group)
  }
  return [...groups.entries()]
    .map(([key, { users, ...group }]) => ({ key, ...group, affectedUsers: users.size }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.affectedUsers - a.affectedUsers || b.count - a.count)
    .slice(0, limit)
}
