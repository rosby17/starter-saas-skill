// Portée d'une erreur ou d'un succès sur une MÊME route. Leçon de production : une route servait deux familles de
// demandes (ex. les voix d'une bibliothèque et des voix personnelles, servies par deux comptes différents). Une
// famille était en panne pendant que l'autre marchait ; chaque succès de la seconde fermait les alertes de la
// première. La route étiquette donc ses réponses (en-tête ERROR_SCOPE_HEADER), l'erreur garde l'étiquette dans
// details.scope, et un succès ne ferme que les erreurs de sa portée.

export const ERROR_SCOPE_HEADER = 'x-error-scope'

/** Valeur d'étiquette sûre (minuscules, chiffres, tiret), sinon null. */
export function normalizeErrorScope(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z0-9-]{1,40}$/.test(value) ? value : null
}

/**
 * Filtre PostgREST (`or=`) des erreurs ouvertes qu'un succès peut fermer :
 * - succès étiqueté : les erreurs de la même portée, et les erreurs sans étiquette qui ne sont pas des pannes (5xx) ;
 * - succès sans étiquette : uniquement les erreurs sans étiquette.
 */
export function successResolutionFilter(scope: string | null): string {
  if (!scope) return 'details->>scope.is.null'
  return `details->>scope.eq.${scope},and(details->>scope.is.null,or(http_status.is.null,http_status.lt.500))`
}
