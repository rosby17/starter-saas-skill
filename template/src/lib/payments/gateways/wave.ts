import type { PaymentGateway } from '../types'
import { manualPaymentWhatsapp } from '../manual-contact'

// Wave MANUEL (Côte d'Ivoire, Sénégal, Togo…) : le client envoie le montant au numéro Wave réglé dans /admin/keys
// (WAVE_NUMBER, WAVE_NAME), puis la capture sur WhatsApp (site.whatsapp). Sans numéro, Wave n'est pas proposé.
// La commande reste « pending » jusqu'à ce que l'administrateur la valide dans /admin/orders une fois l'argent reçu.

export const wave: PaymentGateway = {
  id: 'wave',
  paymentMethod: 'Wave (manuel)',
  isConfigured: () => !!process.env.WAVE_NUMBER,

  async createCheckout({ orderId, plan, amountFcfa }) {
    const reference = `WAVE_${orderId.substring(0, 8).toUpperCase()}`
    const number = process.env.WAVE_NUMBER || ''
    const name = process.env.WAVE_NAME || ''
    const amount = `${amountFcfa.toLocaleString('fr-FR')} FCFA`
    const message = `Bonjour, je viens d'envoyer ${amount} par Wave${name ? ` à ${name}` : ''} (${number}) pour « ${plan.name} ». Référence : ${reference}. Voici la capture :`
    const whatsappUrl = manualPaymentWhatsapp(message)
    return {
      providerRef: reference,
      orderId,
      manual: {
        title: 'Paiement par Wave',
        amount,
        amountNote: plan.name,
        payId: number,
        payIdLabel: name ? `Numéro Wave · au nom de ${name}` : 'Numéro Wave',
        reference,
        whatsappUrl,
        lines: [
          name ? `Dans Wave : Envoyer → colle le numéro ci-dessus. Vérifie que le nom affiché est bien « ${name} ».` : 'Dans Wave : Envoyer → colle le numéro ci-dessus.',
          'Envoie le montant exact (frais Wave en plus, à ta charge).',
          whatsappUrl
            ? 'Envoie la capture sur WhatsApp avec le bouton ci-dessous : dès que le paiement est confirmé, ton accès arrive par e-mail.'
            : 'Garde la capture, puis clique sur « J’ai payé » : dès que le paiement est confirmé, ton accès arrive par e-mail.',
        ],
      },
    }
  },
}
