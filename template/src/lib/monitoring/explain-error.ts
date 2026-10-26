// Explication en clair d'une erreur du journal et GRAVITÉ.
// Règle d'or : la gravité répond à « qui doit agir ? ». Rouge = un bug de NOTRE code.
// Une panne de fournisseur déjà expliquée au client (et remboursée), une coupure brève du proxy
// ou une erreur côté client ne sont jamais critiques : sinon l'admin voit du rouge en permanence
// et ne distingue plus les vrais problèmes.

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low'

export type ExplainableError = {
  source: string
  action: string
  http_status: number | null
  error_message: string | null
  details?: Record<string, unknown> | null
}

export type ErrorExplanation = {
  severity: ErrorSeverity
  feature: string
  cause: string
  fix: string
  clientMessage: string | null
}

export const SEVERITY_ORDER: Record<ErrorSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null)

// Les routes qui échouent à cause d'un fournisseur externe renvoient error_code: 'provider_unavailable'.
// On se base sur ce code, jamais sur le texte du message (qui change selon la langue).
export const isProviderOutage = (error: ExplainableError) => text(error.details?.error_code) === 'provider_unavailable'

// 502/503/504 sans message : réponse du proxy (déploiement, redémarrage, saturation de quelques secondes).
export const isGatewayBlip = (error: ExplainableError) =>
  error.source === 'web' && [502, 503, 504].includes(error.http_status ?? 0) && !text(error.error_message)

// Le service a été mis en pause automatiquement (sonde) ou le modèle demandé n'a plus de moteur disponible :
// le client a lu un message calme, rien n'a été débité. Rien à corriger dans notre code.
const CALM_CODES = ['service_closed', 'model_unavailable']
export const isCalmRefusal = (error: ExplainableError) => CALM_CODES.includes(text(error.details?.error_code) || '')

// Tâche ISOLÉE qu'un fournisseur a fait échouer, laissée « en cours » au-delà du délai ou perdue chez lui : le client
// est remboursé, rien n'est cassé chez nous. Jamais « critique » : à surveiller seulement si cela se répète
// (la sonde, elle, détecte une vraie panne et ferme le service).
const ISOLATED_PROVIDER_REASONS = ['provider_reported_failure', 'stale_still_doing', 'missing_everywhere', 'provider_task_expired']
export const isIsolatedProviderTask = (error: ExplainableError) => ISOLATED_PROVIDER_REASONS.includes(text(error.details?.reason) || '')

// Alertes de la sonde des moteurs (service mis en pause, sonde refusée) : un fournisseur à prévenir, pas un bug.
const WATCHDOG_REASONS = ['service_closed_by_probe', 'probe_rejected']
const isWatchdogAlert = (error: ExplainableError) => WATCHDOG_REASONS.includes(text(error.details?.reason) || '')

const isNetwork = (error: ExplainableError) =>
  text(error.details?.kind) === 'network' || /failed to fetch|load failed|networkerror/i.test(error.error_message || '')

// « /api/payment/webhook/x » -> « payment » : regroupe les erreurs par domaine fonctionnel.
export function featureFor(action: string) {
  const path = action.replace(/^[A-Z]+\s+/, '')
  const match = /^\/api\/([^/?]+)/.exec(path)
  if (match) return match[1]
  return action === 'Erreur JavaScript' ? 'Affichage du site' : 'Autres'
}

function severityFor(error: ExplainableError): ErrorSeverity {
  const status = error.http_status ?? 0
  const kind = text(error.details?.kind)
  if (isProviderOutage(error) || isGatewayBlip(error) || isNetwork(error) || isCalmRefusal(error)) return 'low'
  if (isIsolatedProviderTask(error)) return 'medium'
  if (isWatchdogAlert(error)) return 'high'
  if (error.source === 'server' || status >= 500) return 'critical'
  if (kind === 'js') return /hydrat|react error #(418|419|422|423|425)/i.test(error.error_message || '') ? 'low' : 'medium'
  if (text(error.details?.cause)) return 'high'
  if (status === 429) return 'medium'
  if (status >= 400 && status < 500) return 'low'
  return 'medium'
}

export function explainError(error: ExplainableError): ErrorExplanation {
  const feature = featureFor(error.action)
  const message = text(error.error_message)
  const base = { feature, clientMessage: message }
  const severity = severityFor(error)

  if (isProviderOutage(error)) {
    return { severity, ...base, cause: "Le fournisseur externe n'a pas répondu ou était surchargé. Ce n'est pas un bug de notre code : le client a été prévenu et ses crédits remboursés.", fix: "Rien à corriger. Si cela dure ou touche beaucoup de clients, vérifier l'état du fournisseur." }
  }
  if (isCalmRefusal(error)) {
    return { severity, ...base, cause: "Le service demandé était en pause ou son modèle n'avait plus de moteur disponible : le client a lu un message calme et rien n'a été débité.", fix: 'Rien à corriger dans le code. Voir Administration › Moteurs IA pour l’état des moteurs et des services.' }
  }
  if (isIsolatedProviderTask(error)) {
    return { severity, ...base, cause: "Une tâche isolée a échoué ou est restée bloquée chez le fournisseur : le client a été remboursé, rien n'est cassé chez nous.", fix: 'Rien à corriger si c’est isolé. Si cela se répète, la sonde des moteurs met le service en pause et prévient ici.' }
  }
  if (isGatewayBlip(error)) {
    return { severity, ...base, clientMessage: null, cause: "Le serveur n'a pas répondu pendant quelques secondes (réponse du proxy) : le plus souvent un déploiement ou un redémarrage.", fix: "Rien à corriger si c'est isolé ou si l'heure correspond à un déploiement. Si cela se répète, regarder la charge du serveur." }
  }
  if (isNetwork(error)) {
    return { severity, ...base, cause: "La requête n'a pas atteint le serveur : connexion du client coupée ou page quittée.", fix: 'Rien à corriger si c’est isolé.' }
  }
  if (text(error.details?.cause)) {
    return { severity, ...base, cause: String(error.details?.cause), fix: text(error.details?.fix) || 'Voir les détails techniques.' }
  }
  if (error.source === 'server' || (error.http_status ?? 0) >= 500) {
    return { severity, ...base, cause: `Plantage ou erreur interne du serveur${message ? ` : ${message}` : '.'}`, fix: 'Transmettre la trace des détails techniques au développeur.' }
  }
  if (text(error.details?.kind) === 'js') {
    return { severity, ...base, cause: `Bug d'affichage dans le navigateur : ${message || 'erreur JavaScript'}.`, fix: 'Transmettre la trace des détails techniques au développeur.' }
  }
  if (error.http_status === 401) return { severity, ...base, cause: "Le client n'était plus connecté.", fix: 'Rien à corriger.' }
  if (error.http_status === 429) return { severity, ...base, cause: 'Trop de demandes en peu de temps (limite anti-abus).', fix: 'Le client doit patienter. Si cela touche beaucoup de monde, relever la limite.' }
  return { severity, ...base, cause: message || `Erreur HTTP ${error.http_status ?? 'inconnue'}.`, fix: 'Voir les détails techniques.' }
}
