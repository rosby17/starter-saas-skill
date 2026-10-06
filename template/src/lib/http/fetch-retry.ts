// Rejoue un appel sortant UNIQUEMENT quand la connexion n'a jamais été établie (DNS, refus, délai de connexion) :
// le fournisseur n'a rien reçu, donc aucun doublon ni double facturation possible.
// Un timeout ou une coupure en cours de route est ambigu : on ne rejoue JAMAIS (l'erreur remonte telle quelle).
const NEVER_SENT = new Set(['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'])
const DELAYS_MS = [400, 1200]

export function isNeverSentNetworkError(error: unknown): boolean {
  const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code
  return typeof code === 'string' && NEVER_SENT.has(code)
}

export async function fetchWithConnectRetry(url: string, init: () => RequestInit, fetchImpl: typeof fetch = fetch): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetchImpl(url, init())
    } catch (error) {
      if (attempt >= DELAYS_MS.length || !isNeverSentNetworkError(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, DELAYS_MS[attempt]))
    }
  }
}
