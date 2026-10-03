import { GatewayError, type PaymentGateway } from '../types'

// Warappay (mobile money). Un seul produit à PRIX LIBRE côté Warappay (WARAPPAY_PRODUCT_CODE) sert pour tous les forfaits :
// on envoie le montant exact à chaque paiement. La devise de la boutique Warappay doit correspondre (WARAPPAY_CURRENCY, XAF par défaut).
// Confirmation : webhook signé (route webhook/warappay) + interrogation de l'API au retour du client (route verify).
export const warappay: PaymentGateway = {
  id: 'warappay',
  paymentMethod: 'Warappay',
  isConfigured: () => !!process.env.WARAPPAY_API_KEY && !!process.env.WARAPPAY_PRODUCT_CODE && !!process.env.WARAPPAY_WEBHOOK_SECRET,

  async createCheckout({ orderId, plan, customer, origin }) {
    const response = await fetch('https://api.warappay.com/api/v1/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.WARAPPAY_API_KEY}` },
      body: JSON.stringify({
        product_code: process.env.WARAPPAY_PRODUCT_CODE,
        email: customer.email,
        customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
        ...(customer.phone ? { customer_phone: customer.phone } : {}),
        redirect_url: `${origin}/billing/success?cartId=${orderId}`,
        meta: { order_id: orderId, planId: plan.id },
        amount: Math.round(plan.amountLocal),
        currency: process.env.WARAPPAY_CURRENCY || 'XAF',
      }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.checkout_url) {
      console.error('Warappay:', data)
      throw new GatewayError(data?.error?.message || "Impossible d'initialiser le paiement.", response.ok ? 502 : response.status)
    }
    return { redirectUrl: data.checkout_url, providerRef: data.id || orderId }
  },
}
