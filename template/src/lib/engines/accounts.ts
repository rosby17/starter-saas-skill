import { accountSetAside, isAccountFailure, isRelayable, markAccountUnavailable, markEngineUnavailable } from './health'

// RELAIS ENTRE COMPTES D'UN MÊME FOURNISSEUR. Un moteur peut avoir plusieurs comptes (une clé par compte :
// KIE_API_KEY, KIE_API_KEY_2…). Si un compte refuse (solde épuisé, clé révoquée, saturation, erreur 5xx), il est mis
// de côté et l'appel passe au compte suivant, sans que le client ne voie rien. Quand TOUS les comptes refusent pour
// une raison de compte, le moteur entier est mis de côté (le modèle est alors grisé, ou servi par un autre moteur si
// la bascule automatique est activée).
//
// Règle de sûreté (supervision-exploitation.md) : on ne rejoue JAMAIS une demande qui a peut-être été reçue (délai
// dépassé, coupure en cours de route) : double génération, double facturation. Seuls les refus explicites et les
// erreurs réseau « jamais envoyées » passent au compte suivant.

export type EngineAccount = { id: string; apiKey: string }

/** Comptes d'un moteur, d'après une liste de variables d'environnement (vides ignorées, doublons retirés). */
export function accountsFromEnv(names: string[]): EngineAccount[] {
  const seen = new Set<string>()
  return names.flatMap((name, index) => {
    const apiKey = process.env[name]?.trim()
    if (!apiKey || seen.has(apiKey)) return []
    seen.add(apiKey)
    return [{ id: index === 0 ? 'principal' : `relais-${index}`, apiKey }]
  })
}

/** Erreur d'appel d'un moteur : statut HTTP de la réponse, ou `neverSent` si la connexion n'a jamais été établie. */
export class EngineCallError extends Error {
  constructor(message: string, public status: number | null, public neverSent = false) {
    super(message)
  }
}

/** Le moteur n'a aucun compte en état de répondre : le client lit un message calme, rien n'est débité. */
export class EngineUnavailableError extends Error {
  readonly code = 'model_unavailable'
}

const NEVER_SENT_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'])

/** Erreur réseau où la connexion n'a JAMAIS été établie : le fournisseur n'a rien reçu, rejouer est sans risque. */
export function isNeverSentNetworkError(error: unknown): boolean {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause
  return typeof cause?.code === 'string' && NEVER_SENT_CODES.has(cause.code)
}

/**
 * Appelle `call` sur le premier compte disponible du moteur, puis sur les suivants si le compte refuse.
 * Lève EngineUnavailableError si aucun compte n'est utilisable, ou la dernière erreur si elle n'autorise pas de relais.
 */
export async function runWithAccountRelay<T>(engine: string, list: EngineAccount[], call: (account: EngineAccount) => Promise<T>): Promise<T> {
  const usable = list.filter((account) => !accountSetAside(engine, account.id))
  if (!usable.length) throw new EngineUnavailableError(`${engine} : aucun compte disponible`)
  let accountFailures = 0
  let lastError: unknown = null
  for (const account of usable) {
    try {
      return await call(account)
    } catch (error) {
      lastError = error
      const relayable = error instanceof EngineCallError && (error.neverSent || (error.status !== null && isRelayable(error.status)))
      if (!relayable) throw error
      const status = (error as EngineCallError).status
      if (status !== null && isAccountFailure(status)) accountFailures += 1
      markAccountUnavailable(engine, account.id, (error as Error).message.slice(0, 200), Date.now(), status === 429 ? 60_000 : undefined)
    }
  }
  // Tous les comptes ont refusé pour une raison de compte : le moteur est à sec.
  if (accountFailures === usable.length) markEngineUnavailable(engine, 'tous les comptes refusent (solde, clé ou suspension)')
  throw lastError
}
