import { GatewayError, type PaymentGateway } from '../types'

// Maketou n'a PAS de webhook : la commande est créditée au retour sur /billing/success
// (route verify) et, pour les clients qui ferment l'onglet, par le cron reverify-maketou-orders.
export const maketou: PaymentGateway = {
  id: 'maketou',
  paymentMethod: 'Maketou Checkout',
  isConfigured: () => !!process.env.MAKETOU_API_KEY && !!process.env.MAKETOU_PRODUCT_ID,

  async createCheckout({ plan, currency, customer, origin, amountFcfa }) {
    const payload: Record<string, unknown> = {
      productDocumentId: process.env.MAKETOU_PRODUCT_ID,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      redirectURL: `${origin}/billing/success`,
      // Maketou facture toujours en FCFA : le montant est converti d'après les taux (lib/currency.ts).
      customerPrice: amountFcfa,
      meta: { planId: plan.id, currency },
    }
    if (customer.phone) payload.phone = customer.phone

    const response = await fetch('https://api.maketou.net/api/v1/stores/cart/checkout', {
      signal: AbortSignal.timeout(15_000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.MAKETOU_API_KEY}` },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok || !data.cart?.id || !data.redirectUrl) {
      console.error('Maketou:', data)
      let message = data.message || "Impossible d'initialiser le paiement."
      if (Array.isArray(message)) message = message.map((e: unknown) => JSON.stringify(e)).join(' | ')
      throw new GatewayError(String(message), response.ok ? 502 : response.status)
    }
    return { redirectUrl: data.redirectUrl, providerRef: data.cart.id, orderId: data.cart.id }
  },

  async checkStatus(order) {
    const apiKey = process.env.MAKETOU_API_KEY
    if (!apiKey) return 'unknown'
    const response = await fetch(`https://api.maketou.net/api/v1/stores/cart/${encodeURIComponent(order.payment_ref || order.id)}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!response.ok) return 'unknown'
    const data = await response.json()
    return data.cart?.status === 'completed' ? 'paid' : 'pending'
  },
}
