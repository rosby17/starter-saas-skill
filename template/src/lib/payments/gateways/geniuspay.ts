import { GatewayError, type PaymentGateway } from '../types'

// GeniusPay (mobile money et carte), facture toujours en XOF. Doc : https://geniuspay.ci/docs/api
// Confirmation : webhook signé (HMAC-SHA256 de « horodatage.corps ») puis relecture du paiement par l'API (elle fait foi).
export const GENIUSPAY_API = 'https://geniuspay.ci/api/v1/merchant'
export const GENIUSPAY_MIN_XOF = 200

export const geniusPayHeaders = () => ({
  'Content-Type': 'application/json',
  'X-API-Key': process.env.GENIUSPAY_API_KEY || '',
  'X-API-Secret': process.env.GENIUSPAY_API_SECRET || '',
})

export const geniuspay: PaymentGateway = {
  id: 'geniuspay',
  paymentMethod: 'GeniusPay',
  isConfigured: () => !!process.env.GENIUSPAY_API_KEY && !!process.env.GENIUSPAY_API_SECRET && !!process.env.GENIUSPAY_WEBHOOK_SECRET,

  async createCheckout({ orderId, plan, customer, origin, paymentType, amountFcfa }) {
    const amount = amountFcfa
    if (!(amount >= GENIUSPAY_MIN_XOF)) throw new GatewayError('Montant trop faible pour ce moyen de paiement.', 400)
    const body: Record<string, unknown> = {
      amount,
      currency: 'XOF',
      description: `${plan.name}`,
      customer: { name: `${customer.firstName} ${customer.lastName}`.trim(), email: customer.email, ...(customer.phone ? { phone: customer.phone } : {}) },
      success_url: `${origin}/billing/success?cartId=${orderId}`,
      error_url: `${origin}/billing`,
      metadata: { order_id: orderId, planId: plan.id },
    }
    if (paymentType === 'card') body.payment_method = 'card'
    const response = await fetch(`${GENIUSPAY_API}/payments`, { method: 'POST', headers: geniusPayHeaders(), body: JSON.stringify(body) })
    const data = await response.json().catch(() => null)
    const tx = data?.data
    const redirectUrl = tx?.checkout_url || tx?.payment_url
    if (!response.ok || !data?.success || !tx?.reference || !redirectUrl) {
      console.error('GeniusPay:', response.status, data)
      throw new GatewayError(data?.error?.message || "Impossible d'initialiser le paiement.", response.ok ? 502 : response.status)
    }
    return { redirectUrl, providerRef: tx.reference }
  },
}
