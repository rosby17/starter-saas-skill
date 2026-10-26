import { recordErrorLog } from '@/lib/monitoring/error-log'
import { notifyAdmin } from '@/lib/orders/deliver'

// CLÉ D'UNE PASSERELLE REFUSÉE (brique verrouillée du kit). Leçon de production (23/10/2026) : une passerelle
// répondait « 401 Unauthenticated » à chaque paiement ; le client voyait une erreur d'initialisation, le 401 renvoyé
// tel quel était classé « faible » dans le journal et personne n'était prévenu.
//
// Désormais : la passerelle est marquée INDISPONIBLE (le checkout passe à la suivante du même moyen, et le moyen
// disparaît de la page de paiement s'il n'en reste aucune), le client lit « momentanément indisponible » (503),
// une erreur CRITIQUE est journalisée avec la cause et le remède, et l'administrateur reçoit un e-mail (au plus un
// par passerelle et par demi-heure). La marque dure 10 minutes : une clé recollée dans /admin/keys est réessayée seule.

const REFUSED_MS = 10 * 60 * 1000
const EMAIL_INTERVAL_MS = 30 * 60 * 1000
const refusedUntil = new Map<string, number>()
const lastEmailAt = new Map<string, number>()

/** 401 / 403 de la passerelle : c'est NOTRE clé qui est refusée, le client n'y peut rien. */
export const isKeyRefusal = (status: number) => status === 401 || status === 403

export const isGatewayKeyRefused = (gatewayId: string, now = Date.now()) => (refusedUntil.get(gatewayId) ?? 0) > now

/** À appeler quand une clé est de nouveau acceptée (enregistrement d'une nouvelle clé, paiement réussi). */
export const clearGatewayKeyRefused = (gatewayId: string) => { refusedUntil.delete(gatewayId) }

export async function alertGatewayKeyRefused(params: { gatewayId: string; label: string; category: string; providerStatus: number; providerMessage?: string | null; userId?: string | null }) {
  const { gatewayId, label, category, providerStatus, providerMessage, userId } = params
  refusedUntil.set(gatewayId, Date.now() + REFUSED_MS)
  const cause = `${label} refuse notre clé d'API (HTTP ${providerStatus}${providerMessage ? ` « ${providerMessage.slice(0, 160)} »` : ''}) : clé régénérée, révoquée ou compte suspendu. Tous les paiements ${label} échouent.`
  const fix = `Générer une nouvelle clé dans le tableau de bord ${label} et la coller dans Administration › Clés et intégrations. En attendant, les clients passent par une autre passerelle du même moyen si elle est configurée (Administration › Moyens de paiement), sinon ce moyen est retiré de la page de paiement.`
  try {
    await recordErrorLog({
      userId,
      source: 'server',
      page: '/api/payment/checkout',
      action: 'POST /api/payment/checkout',
      httpStatus: 503,
      errorMessage: `${label} : clé d'API refusée (HTTP ${providerStatus})`,
      details: { reason: 'gateway_key_refused', gateway: gatewayId, category, provider_status: providerStatus, cause, fix, client_message: 'Ce moyen de paiement est momentanément indisponible.' },
    })
    const last = lastEmailAt.get(gatewayId)
    if (last !== undefined && Date.now() - last < EMAIL_INTERVAL_MS) return
    lastEmailAt.set(gatewayId, Date.now())
    await notifyAdmin(`Paiements bloqués : ${label} refuse la clé d'API`, [cause, `Moyen choisi par le client : ${category}.`, `À faire : ${fix}`], '/admin/payment-providers')
  } catch (error) {
    console.error(`Alerte « clé ${label} refusée » non envoyée (non bloquant) :`, error)
  }
}
