import type { PaymentGateway } from '../types'
import { manualPaymentWhatsapp } from '../manual-contact'

// MOBILE MONEY DIRECT (manuel) : le client envoie le montant sur les numéros Mobile Money du vendeur, par dépôt
// (transfert) ou par CODE MARCHAND (ex. MTN MoMo au Cameroun : *126*14*<numéro marchand>*<montant>#), puis la capture
// sur WhatsApp (site.whatsapp). Aucune passerelle, aucune commission. La commande reste « pending » jusqu'à ce que
// l'administrateur la valide dans /admin/orders une fois l'argent reçu.
//
// Réglages dans /admin/keys (ou Administration › Moyens de paiement › Coordonnées) : jusqu'à deux numéros
// (MOMO_DIRECT_1_* et MOMO_DIRECT_2_*), chacun avec son opérateur et, s'il existe, son code marchand où {montant} est
// remplacé par le montant exact ; le titulaire (MOMO_DIRECT_HOLDER) ; le pays des numéros (MOMO_DIRECT_COUNTRY, code
// ISO, ex. CM). Ouvert à TOUS les pays : un client de la diaspora fait payer un proche sur place. Montant toujours
// en FCFA (hors zone FCFA : son prix converti, arrondi aux 50 FCFA supérieurs, calculé par le checkout).

const SLOTS = [1, 2] as const

export type MomoDirectAccount = { operator: string; number: string; ussd?: string }

/** Numéros réglés, dans l'ordre (vides ignorés). Lu à chaque appel : un changement dans l'admin vaut tout de suite. */
export function momoDirectAccounts(): MomoDirectAccount[] {
  return SLOTS.flatMap((slot) => {
    const number = process.env[`MOMO_DIRECT_${slot}_NUMBER`]?.trim()
    if (!number) return []
    const operator = process.env[`MOMO_DIRECT_${slot}_OPERATOR`]?.trim() || 'Mobile Money'
    const ussd = process.env[`MOMO_DIRECT_${slot}_USSD`]?.trim() || undefined
    return [{ operator, number, ussd }]
  })
}

/** Code marchand prêt à composer : {montant} remplacé par le montant exact, en chiffres. */
export const fillUssd = (template: string, amountFcfa: number) => template.replace(/\{montant\}/gi, String(Math.round(amountFcfa)))

export const momoDirect: PaymentGateway = {
  id: 'momo_direct',
  paymentMethod: 'Mobile Money direct (manuel)',
  isConfigured: () => momoDirectAccounts().length > 0,

  async createCheckout({ orderId, plan, amountFcfa }) {
    const reference = `MOMO_${orderId.substring(0, 8).toUpperCase()}`
    const holder = process.env.MOMO_DIRECT_HOLDER?.trim() || undefined
    const amount = `${amountFcfa.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')} FCFA`
    const accounts = momoDirectAccounts().map((a) => ({ operator: a.operator, number: a.number, holder, ussd: a.ussd ? fillUssd(a.ussd, amountFcfa) : undefined }))
    const numbers = accounts.map((a) => `${a.operator} ${a.number}`).join(' / ')
    const message = `Bonjour, je viens d'envoyer ${amount} par Mobile Money (${numbers}) pour « ${plan.name} ». Référence : ${reference}. Voici la capture :`
    const whatsappUrl = manualPaymentWhatsapp(message)
    const hasUssd = accounts.some((a) => a.ussd)
    return {
      providerRef: reference,
      orderId,
      manual: {
        title: 'Paiement par Mobile Money',
        amount,
        amountNote: plan.name,
        reference,
        whatsappUrl,
        accounts,
        lines: [
          hasUssd
            ? 'Code marchand : compose-le depuis ton téléphone, le montant est déjà dedans, puis valide avec ton code secret. Sinon, envoie le montant exact au numéro (transfert).'
            : `Dans ton application Mobile Money : Transfert → colle le numéro ci-dessus${holder ? ` et vérifie que le nom affiché est bien « ${holder} »` : ''}.`,
          'Envoie le montant exact (frais de transfert à ta charge). Pas sur place ? Un proche peut payer pour toi : donne-lui le montant et la référence.',
          whatsappUrl
            ? 'Envoie la capture sur WhatsApp avec le bouton ci-dessous : dès que le paiement est confirmé, ton accès arrive par e-mail.'
            : 'Garde la capture, puis clique sur « J’ai payé » : dès que le paiement est confirmé, ton accès arrive par e-mail.',
        ],
      },
    }
  },
}
