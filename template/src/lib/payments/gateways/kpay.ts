import { GatewayError, type PaymentGateway } from '../types'

// K-Pay (carte bancaire), facture en USD. Confirmation par webhook signé (HMAC-SHA256 du corps, en-tête x-kpay-signature).
export const kpay: PaymentGateway = {
  id: 'kpay',
  paymentMethod: 'K-Pay',
  isConfigured: () => !!process.env.KPAY_API_KEY && !!process.env.KPAY_SECRET_KEY && !!process.env.KPAY_WEBHOOK_SECRET,

  async createCheckout({ orderId, plan, customer, origin }) {
    if (!(plan.amountUsd > 0)) throw new GatewayError('Ce forfait ne peut pas être payé par carte.', 400)
    const returnUrl = `${origin}/billing/success?cartId=${orderId}&provider=kpay`
    const response = await fetch('https://admin.kpay.site/api/v1/payments/init', {
      signal: AbortSignal.timeout(15_000),
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.KPAY_API_KEY!, 'X-Secret-Key': process.env.KPAY_SECRET_KEY! },
      body: JSON.stringify({
        amount: Number(plan.amountUsd.toFixed(2)),
        paymentMethod: 'CARD',
        externalId: orderId,
        returnUrl,
        successUrl: returnUrl,
        description: `${plan.name} - ${plan.amountUsd.toFixed(2)} USD`,
        customerEmail: customer.email,
        metadata: { planId: plan.id },
      }),
    })
    const data = await response.json().catch(() => null)
    const redirectUrl = data?.checkoutUrl || data?.paymentUrl || data?.redirectUrl || data?.hostedPageUrl || data?.url || data?.link
    if (!response.ok || !redirectUrl) {
      console.error('K-Pay:', response.status, data)
      throw new GatewayError(data?.message || "Impossible d'initialiser le paiement.", response.ok ? 502 : response.status)
    }
    return { redirectUrl, providerRef: orderId }
  },
}
