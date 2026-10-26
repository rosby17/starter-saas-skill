// Règles de la SONDE DES MOTEURS (provider-watchdog.ts), sans dépendance pour rester testables seules.
//
// Leçon de production : un fournisseur acceptait toutes les demandes mais n'en terminait plus aucune, sur tous ses
// comptes. Les envois réussissant, aucun échec n'était compté et les clients attendaient longtemps avant d'être
// remboursés. La sonde envoie une demande minuscule sur deux comptes différents : si aucun ne la termine, deux fois
// de suite, le SERVICE concerné est mis en pause dans l'espace client ; il rouvre dès qu'une sonde aboutit.
//
// Règle absolue : on ne ferme JAMAIS tout le site ni l'API. Seul le service en panne est mis en pause, et seulement
// dans l'espace client : un client qui utilise un autre service, ou l'API avec sa clé, continue de travailler.

/** Une demande minuscule sort en quelques secondes ; au-delà de 4 min, elle est bloquée. */
export const PROBE_TIMEOUT_MS = 4 * 60 * 1000
/** Sondes ratées d'affilée avant la pause : une seule peut être un hasard. */
export const FAILURES_TO_TRIP = 2
/** Cadence normale, et cadence resserrée pendant une panne pour rouvrir vite. */
export const PROBE_INTERVAL_MS = 5 * 60 * 1000
export const PROBE_INTERVAL_DOWN_MS = 2 * 60 * 1000
/** Sonde refusée (4xx) pendant plus d'une heure : elle ne voit plus rien, on le signale. */
export const BLIND_ALERT_AFTER_MS = 60 * 60 * 1000

export type ProbeAttempt = {
  /** Envoi refusé (4xx hors 429 : paramètre, solde) : ne dit rien de la santé du service. */
  rejected?: boolean
  /** Envoi impossible (réseau, délai, 5xx) : le service ne prend pas la demande. */
  submitFailed?: boolean
  /** Statut lu chez le fournisseur : done, pending, error… (vide = encore en cours). */
  status?: string
  hasResult?: boolean
  ageMs: number
}

export type ProbeOutcome = 'ok' | 'stuck' | 'inconclusive'

const RUNNING = new Set(['doing', 'pending', 'processing', 'queued', 'running', 'in_progress', ''])
const FAILED = new Set(['error', 'failed'])

/** Résultat d'une sonde, ou « pending » tant qu'elle n'est pas tranchée. */
export function probeOutcome(attempts: ProbeAttempt[], timeoutMs = PROBE_TIMEOUT_MS): ProbeOutcome | 'pending' {
  if (attempts.length === 0) return 'inconclusive'
  // Un seul compte qui livre suffit : le relais entre comptes y envoie les clients.
  if (attempts.some((a) => a.hasResult)) return 'ok'
  const settled = attempts.map((a) => {
    if (a.rejected) return 'rejected'
    if (a.submitFailed) return 'failed'
    const status = String(a.status || '').toLowerCase()
    if (FAILED.has(status)) return 'failed'
    if (RUNNING.has(status)) return a.ageMs > timeoutMs ? 'failed' : 'pending'
    return 'ok' // terminé sans résultat lisible : rien de bloqué
  })
  if (settled.includes('ok')) return 'ok'
  if (settled.includes('pending')) return 'pending'
  if (settled.every((s) => s === 'rejected')) return 'inconclusive'
  return 'stuck'
}

export type WatchdogState = { down: boolean; failures: number }
export type WatchdogAction = 'enter' | 'exit' | 'none'

export function nextWatchdogState(state: WatchdogState, outcome: ProbeOutcome): { state: WatchdogState; action: WatchdogAction } {
  if (outcome === 'inconclusive') return { state, action: 'none' }
  if (outcome === 'ok') return { state: { down: false, failures: 0 }, action: state.down ? 'exit' : 'none' }
  const failures = state.failures + 1
  if (!state.down && failures >= FAILURES_TO_TRIP) return { state: { down: true, failures }, action: 'enter' }
  return { state: { down: state.down, failures }, action: 'none' }
}

export const probeIntervalMs = (state: WatchdogState) => (state.down || state.failures > 0 ? PROBE_INTERVAL_DOWN_MS : PROBE_INTERVAL_MS)

// ── Services en pause ────────────────────────────────────────────────────────
// auto = posé par la sonde (elle le lève seule) ; false = posé par l'admin (la sonde n'y touche jamais).
export type OutageTrigger = 'probe' | 'admin'
export type ServiceOutage = { since: string; auto: boolean; trigger?: OutageTrigger }
export type ServiceOutages = Record<string, ServiceOutage>

export function closeService(current: ServiceOutages | null, service: string, now: Date, options: { auto?: boolean; trigger?: OutageTrigger } = {}): ServiceOutages | null {
  if (current?.[service]) return null
  return { ...(current || {}), [service]: { since: now.toISOString(), auto: options.auto ?? true, ...(options.trigger ? { trigger: options.trigger } : {}) } }
}

export function reopenService(current: ServiceOutages | null, service: string, options: { onlyAuto?: boolean } = {}): ServiceOutages | null {
  if (!current?.[service]) return null
  if (options.onlyAuto && current[service].auto === false) return null
  const next = { ...current }
  delete next[service]
  return next
}

export function closedServices(value: unknown, known: string[]): string[] {
  if (!value || typeof value !== 'object') return []
  return known.filter((service) => Boolean((value as ServiceOutages)[service]))
}
