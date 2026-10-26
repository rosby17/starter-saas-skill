// SANTÉ DES MOTEURS : un client ne doit JAMAIS être envoyé vers un moteur à sec (solde épuisé, clé refusée, compte
// suspendu). Un moteur qui refuse pour une raison de compte est « mis de côté » quelques minutes, sans attendre
// l'échec suivant ; un compte précis d'un moteur aussi (relais vers un autre compte, voir accounts.ts). Le modèle
// n'est grisé que si plus aucun moteur ne peut le servir (router.ts).
//
// État tenu en mémoire : suffisant pour une seule copie de l'application (cas du kit). Avec plusieurs copies,
// chacune apprend seule en un appel, ce qui reste sans conséquence pour le client.

const SET_ASIDE_MS = 5 * 60_000

type Aside = { until: number; reason: string }
const engines = new Map<string, Aside>()
const accounts = new Map<string, Aside>()

/** Refus qui signale une panne de compte (solde, clé, suspension), pas un défaut de la demande. */
export const isAccountFailure = (status: number) => status === 401 || status === 402 || status === 403

/** Refus qui justifie d'essayer un autre compte : compte en panne, saturation, erreur du fournisseur. */
export const isRelayable = (status: number) => isAccountFailure(status) || status === 429 || status >= 500

function setAside(map: Map<string, Aside>, key: string, reason: string, now: number, durationMs: number) {
  const current = map.get(key)
  if (!current || current.until < now) console.warn(`[engines] ${key} mis de côté ${Math.round(durationMs / 60_000)} min : ${reason}`)
  // Une mise de côté plus longue déjà en cours n'est jamais raccourcie.
  map.set(key, { until: Math.max(now + durationMs, current?.until ?? 0), reason })
}

const active = (map: Map<string, Aside>, key: string, now: number) => {
  const current = map.get(key)
  return current && current.until > now ? current : null
}

export function markEngineUnavailable(engine: string, reason: string, now = Date.now(), durationMs = SET_ASIDE_MS) {
  setAside(engines, engine, reason, now, durationMs)
}
export const engineSetAside = (engine: string, now = Date.now()) => active(engines, engine, now)

export function markAccountUnavailable(engine: string, account: string, reason: string, now = Date.now(), durationMs = SET_ASIDE_MS) {
  setAside(accounts, `${engine}:${account}`, reason, now, durationMs)
}
export const accountSetAside = (engine: string, account: string, now = Date.now()) => active(accounts, `${engine}:${account}`, now)

/** Moteur remis en service (bouton de l'admin, ou succès constaté). */
export function clearEngine(engine: string) {
  engines.delete(engine)
  for (const key of [...accounts.keys()]) if (key.startsWith(`${engine}:`)) accounts.delete(key)
}

/** Pour les tests. */
export function resetEngineHealth() {
  engines.clear()
  accounts.clear()
}
