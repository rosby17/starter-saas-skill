import { GatewayError, type PaymentGateway } from '../types'

// Warappay : mobile money ET carte ET PayPal (un seul produit à PRIX LIBRE chez Warappay, le montant exact est
// envoyé à chaque paiement). Il signe ses webhooks (HMAC SHA-256 du corps brut, voir route webhook/warappay) et la
// route verify relit le paiement au retour du client. L'identifiant de NOTRE commande voyage dans meta.order_id.
export const warappay: PaymentGateway = {
  id: 'warappay',
  paymentMethod: 'Warappay',
  isConfigured: () => !!process.env.WARAPPAY_API_KEY && !!process.env.WARAPPAY_PRODUCT_CODE && !!process.env.WARAPPAY_WEBHOOK_SECRET,

  // Lecture d'un paiement qui n'existe pas : 401 = clé refusée ; toute autre réponse = clé acceptée.
  async checkKey() {
    try {
      const r = await fetch('https://api.warappay.com/api/v1/checkout/00000000-0000-0000-0000-000000000000', { headers: { Accept: 'application/json', Authorization: `Bearer ${process.env.WARAPPAY_API_KEY}` }, signal: AbortSignal.timeout(5000) })
      return r.status !== 401 && r.status !== 403
    } catch { return null }
  },

  async createCheckout({ orderId, plan, customer, origin, amountFcfa, paymentType }) {
    const payload: Record<string, unknown> = {
      product_code: process.env.WARAPPAY_PRODUCT_CODE,
      email: customer.email,
      customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
      redirect_url: `${origin}/paiement/succes?cartId=${orderId}`,
      meta: { order_id: orderId, planId: plan.id, payment_type: paymentType },
      amount: amountFcfa,
      // Doit correspondre à la devise de la boutique Warappay (XOF = Afrique de l'Ouest, XAF = Afrique centrale) :
      // sinon Warappay répond CURRENCY_MISMATCH.
      currency: process.env.WARAPPAY_CURRENCY || 'XOF',
    }
    if (customer.phone) payload.customer_phone = customer.phone

    const response = await fetch('https://api.warappay.com/api/v1/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.WARAPPAY_API_KEY}` },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok || !data.checkout_url) {
      console.error('Warappay:', data)
      throw new GatewayError(data?.error?.message || "Impossible d'initialiser le paiement.", response.ok ? 502 : response.status)
    }
    return { redirectUrl: data.checkout_url, providerRef: data.id || orderId, orderId }
  },
}
