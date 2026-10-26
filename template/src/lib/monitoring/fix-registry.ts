// REGISTRE DES CORRECTIFS : chaque correctif livré déclare ici les erreurs qu'il règle et le moment où il est en
// production. autoResolveStaleErrors (auto-resolve.ts) ferme alors toutes les erreurs ouvertes correspondantes
// ANTÉRIEURES au correctif : l'administrateur n'a rien à cocher. Une erreur identique survenue APRÈS `fixedAt`
// reste ouverte : c'est un nouveau cas, pas l'ancien bug.
//
// Règle : tout correctif d'une erreur visible dans Administration › Erreurs ajoute UNE entrée ci-dessous, dans le
// même commit que le correctif. `fixedAt` = heure de fusion + le temps de construction et de mise en ligne
// (≈ 20 min), en UTC. Jamais une heure antérieure à la fusion : on fermerait des erreurs que le correctif n'a pas
// encore pu régler.
//
// La signature (`matches`) s'appuie sur ce qui est stable : l'action (« POST /api/… »), le statut HTTP, le code
// d'erreur (`details.error_code`, `details.reason`). Le texte du message ne sert qu'en dernier recours (il change
// selon la langue et le fournisseur).

export type FixableError = {
  created_at: string
  action?: string | null
  error_message?: string | null
  http_status?: number | null
  details?: Record<string, unknown> | null
  page?: string | null
}

export type ErrorFix = {
  /** Identifiant court et stable (ex. « checkout-cle-refusee »). */
  id: string
  /** Numéro de la demande de fusion (PR) qui livre le correctif ; 0 si livré sans PR. */
  pr: number
  /** Heure de mise en production, ISO UTC (ex. « 2026-10-23T12:05:00Z »). */
  fixedAt: string
  /** Ce qui a été corrigé, en une phrase (affiché dans la note de résolution). */
  summary: string
  matches: (error: FixableError) => boolean
}

/** Code d'erreur posé à la source (details.error_code), ou chaîne vide. */
export const errorCode = (error: FixableError) => (typeof error.details?.error_code === 'string' ? error.details.error_code : '')
/** Raison détaillée (details.reason), ou chaîne vide. */
export const errorReason = (error: FixableError) => (typeof error.details?.reason === 'string' ? error.details.reason : '')

// Exemple d'entrée (à recopier) :
//   {
//     id: 'checkout-cle-refusee',
//     pr: 42,
//     fixedAt: '2026-10-23T12:05:00Z',
//     summary: "une passerelle qui refuse notre clé n'est plus montrée au client comme un 401",
//     matches: (error) => error.action === 'POST /api/payment/checkout' && error.http_status === 401,
//   },
export const ERROR_FIXES: ErrorFix[] = []

/** Correctif qui règle cette erreur, si elle lui est antérieure. */
export function fixFor(error: FixableError, fixes: ErrorFix[] = ERROR_FIXES): ErrorFix | null {
  const createdAt = new Date(error.created_at).getTime()
  if (!Number.isFinite(createdAt)) return null
  return fixes.find((fix) => createdAt < new Date(fix.fixedAt).getTime() && fix.matches(error)) ?? null
}

/** Date du correctif le plus récent : seules les erreurs plus anciennes sont concernées. */
export function latestFixAt(fixes: ErrorFix[] = ERROR_FIXES): string | null {
  return fixes.reduce<string | null>((latest, fix) => (!latest || fix.fixedAt > latest ? fix.fixedAt : latest), null)
}
