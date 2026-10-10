import { GatewayError, type PaymentGateway } from '../types'

// TaraMoney envoie un webhook (route webhook/taramoney) qui n'est pas signé : un secret partagé est
// glissé dans l'URL de rappel, jamais exposé au navigateur, et vérifié par la route avant de créditer.
export const taramoney: PaymentGateway = {
  id: 'taramoney',
  paymentMethod: 'TaraMoney',
  isConfigured: () => !!process.env.TARA_API_KEY && !!process.env.TARA_BUSINESS_ID && !!process.env.TARA_WEBHOOK_SECRET,

  async createCheckout({ orderId, plan, currency, origin, amountFcfa }) {
    const secret = process.env.TARA_WEBHOOK_SECRET!
    const toHttps = (url: string) => url.replace(/^http:\/\//, 'https://')
    const returnUrl = toHttps(`${origin}/paiement/succes?cartId=${orderId}`)
    const webHookUrl = toHttps(`${origin}/api/payment/webhook/taramoney?key=${encodeURIComponent(secret)}`)
    const price = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(plan.amountLocal)

    const response = await fetch('https://www.dklo.co/api/tara/paymentlinks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.TARA_API_KEY,
        businessId: process.env.TARA_BUSINESS_ID,
        productId: orderId,
        productName: `${plan.name} — ${price} ${currency}`,
        // TaraMoney règle en FCFA : le montant est converti d'après les taux (lib/currency.ts).
        productPrice: amountFcfa,
        productDescription: `Total : ${price} ${currency}. Aucun montant supérieur ne sera débité.`,
        returnUrl,
        webHookUrl,
      }),
    })
    const data = await response.json()
    const ok = data.status === 'success' || data.status === 'SUCCESS'
    const redirectUrl = data.generalLink || data.cardLink
    if (!response.ok || !ok || !redirectUrl) {
      console.error('TaraMoney:', data)
      throw new GatewayError(data.message || data.status || "Impossible d'initialiser le paiement.", response.ok ? 400 : response.status)
    }
    return { redirectUrl, providerRef: orderId }
  },
}
