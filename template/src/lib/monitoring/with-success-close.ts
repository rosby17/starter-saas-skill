import { after } from 'next/server'
import { resolveErrorsOnSuccess } from '@/lib/monitoring/auto-resolve'
import { ERROR_SCOPE_HEADER } from '@/lib/monitoring/error-scope'

// Enveloppe d'une route API : quand elle répond sans erreur (< 400), les erreurs ouvertes de la même action
// (« POST /api/… », le format qu'utilisent ErrorReporter et les routes) se ferment seules. Ne ralentit pas la
// réponse (after()). Le chemin vient de request.url, dont seule l'ORIGINE est fausse en production (adresse du
// conteneur) : le chemin, lui, est exact.
//
//   export const POST = withSuccessClose(async (request: Request) => { … })
//
// Une route qui sert deux familles de demandes ajoute l'en-tête `x-error-scope` (voir error-scope.ts) à ses
// réponses ET met `scope` dans les détails de ses erreurs.
export function withSuccessClose<R extends Request, A extends unknown[]>(
  handler: (request: R, ...rest: A) => Promise<Response> | Response,
): (request: R, ...rest: A) => Promise<Response> {
  return async (request, ...rest) => {
    const startedAt = new Date()
    const response = await handler(request, ...rest)
    if (response.status < 400) {
      const work = resolveErrorsOnSuccess(`${request.method} ${new URL(request.url).pathname}`, startedAt, response.headers.get(ERROR_SCOPE_HEADER))
      try { after(work) } catch { void work }
    }
    return response
  }
}
