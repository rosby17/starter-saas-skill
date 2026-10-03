import type { PaymentGateway } from '../types'

// Binance Pay MANUEL : aucune API, aucun webhook. Le client envoie le paiement à l'identifiant Binance Pay du vendeur
// en indiquant la référence ; la commande reste « pending » jusqu'à ce qu'un administrateur la valide dans
// /admin/orders (action « Marquer payée »). Aucune redirection.
export const binance: PaymentGateway = {
  id: 'binance',
  paymentMethod: 'Binance Pay (manuel)',
  isConfigured: () => !!process.env.BINANCE_PAY_ID,

  async createCheckout({ orderId, plan, amountFcfa }) {
    const reference = `BINANCE_${orderId.substring(0, 8).toUpperCase()}`
    return {
      providerRef: reference,
      orderId,
      manual: {
        title: 'Paiement Binance Pay',
        lines: [
          `Forfait : ${plan.name}`,
          `Montant : ${plan.amountUsd} USD (équivalent ${amountFcfa.toLocaleString('fr-FR')} FCFA)`,
          `Binance Pay ID : ${process.env.BINANCE_PAY_ID}`,
          `Référence à indiquer dans la note : ${reference}`,
          'Ton compte est crédité dès que le paiement est vérifié par notre équipe.',
        ],
      },
    }
  },
}
