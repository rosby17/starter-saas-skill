import { GatewayError, type PaymentGateway } from '../types'

// Maketou (maketou.net) : Mobile Money en FCFA, un « produit » Maketou à prix libre (customerPrice envoyé à chaque
// paiement, calculé côté serveur). PAS de webhook : la commande est créditée par la route verify au retour du client
// et par le cron reconcile-orders (checkStatus) pour ceux qui ferment l'onglet. Livraison atomique : jamais deux fois.
// Statuts d'un panier : waiting_payment, completed, abandoned, payment_failed.
const API = 'https://api.maketou.net/api/v1/stores/cart'

export const maketou: PaymentGateway = {
  id: 'maketou',
  paymentMethod: 'Maketou',
  isConfigured: () => !!process.env.MAKETOU_API_KEY && !!process.env.MAKETOU_PRODUCT_ID,

  // Lecture d'un panier qui n'existe pas : 401 / 403 = clé refusée ; toute autre réponse = clé acceptée.
  async checkKey() {
    try {
      const r = await fetch(`${API}/00000000-0000-0000-0000-000000000000`, { headers: { Authorization: `Bearer ${process.env.MAKETOU_API_KEY}` }, signal: AbortSignal.timeout(5000) })
      return r.status !== 401 && r.status !== 403
    } catch { return null }
  },

  async createCheckout({ orderId, plan, customer, origin, amountFcfa, paymentType }) {
    const payload: Record<string, unknown> = {
      productDocumentId: process.env.MAKETOU_PRODUCT_ID,
      email: customer.email,
      firstName: customer.firstName || 'Client',
      lastName: customer.lastName || '-',
      customerPrice: amountFcfa,
      redirectURL: `${origin}/paiement/succes?cartId=${orderId}`,
      meta: { order_id: orderId, planId: plan.id, payment_type: paymentType },
    }
    if (customer.phone) payload.phone = customer.phone

    const response = await fetch(`${API}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MAKETOU_API_KEY}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.cart?.id || !data.redirectUrl) {
      console.error('Maketou:', response.status, data?.message ?? data)
      let message = data?.message || "Impossible d'initialiser le paiement."
      if (Array.isArray(message)) message = message.map((e: unknown) => (typeof e === 'string' ? e : JSON.stringify(e))).join(' | ')
      throw new GatewayError(String(message), response.ok ? 502 : response.status)
    }
    return { redirectUrl: data.redirectUrl, providerRef: String(data.cart.id), orderId }
  },

  async checkStatus(order) {
    if (!process.env.MAKETOU_API_KEY || !order.payment_ref) return 'unknown'
    try {
      const response = await fetch(`${API}/${encodeURIComponent(order.payment_ref)}`, {
        headers: { Authorization: `Bearer ${process.env.MAKETOU_API_KEY}` },
        // Borné à 6 s : un fournisseur lent ne doit bloquer ni le retour du client ni le rattrapage (45 s au total).
        signal: AbortSignal.timeout(6_000),
        cache: 'no-store',
      })
      if (!response.ok) return 'unknown'
      const data = await response.json()
      // Selon la version de l'API, le statut est à la racine ou dans « cart ».
      const status = data?.status ?? data?.cart?.status
      return status === 'completed' ? 'paid' : status ? 'pending' : 'unknown'
    } catch {
      return 'unknown'
    }
  },
}
