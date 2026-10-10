import type { PaymentGateway } from '../types'
import { manualPaymentWhatsapp } from '../manual-contact'

// Binance Pay MANUEL : aucune API, aucun webhook. Le client envoie le paiement à l'identifiant Binance Pay du vendeur
// en indiquant la référence ; la commande reste « pending » jusqu'à ce qu'un administrateur la valide dans
// /admin/orders (action « Marquer payée »). Aucune redirection. Proposé dès qu'un Binance Pay ID OU une adresse USDT TRC20
// est réglé dans /admin/keys ; sans Binance Pay ID, seul l'onglet USDT (TRC20) s'affiche.
export const binance: PaymentGateway = {
  id: 'binance',
  paymentMethod: 'Binance Pay (manuel)',
  isConfigured: () => !!(process.env.BINANCE_PAY_ID || process.env.USDT_TRC20_ADDRESS),

  async createCheckout({ orderId, plan, amountFcfa }) {
    const reference = `BINANCE_${orderId.substring(0, 8).toUpperCase()}`
    const amount = `${plan.amountUsd} USDT`
    const payId = process.env.BINANCE_PAY_ID || undefined
    const usdt = process.env.USDT_TRC20_ADDRESS || ''
    const message = `Bonjour, je viens de payer ${amount} en crypto pour « ${plan.name} ». Référence : ${reference}. Voici la capture :`
    const whatsappUrl = manualPaymentWhatsapp(message)
    const proof = whatsappUrl ? 'Envoie la capture sur WhatsApp avec le bouton ci-dessous' : 'Garde la capture, puis clique sur « J’ai payé »'
    return {
      providerRef: reference,
      orderId,
      manual: {
        title: payId ? 'Paiement Binance Pay' : 'Paiement en USDT (TRC20)',
        amount,
        amountNote: `≈ ${amountFcfa.toLocaleString('fr-FR')} FCFA · ${plan.name}`,
        tab: 'Binance Pay',
        payId,
        payIdLabel: process.env.BINANCE_PAY_NAME ? `Binance Pay ID · au nom de ${process.env.BINANCE_PAY_NAME}` : 'Binance Pay ID',
        reference,
        whatsappUrl,
        // Sans compte Binance : USDT sur le réseau TRON (TRC20), depuis n'importe quel portefeuille (Trust Wallet, OKX, Bybit…).
        // Pas de Binance Pay ID : la page n'affiche que cet onglet (sans onglets). Pas d'adresse : pas d'onglet USDT.
        alt: usdt ? {
          tab: 'USDT (TRC20)',
          label: 'Adresse USDT · réseau TRON (TRC20)',
          address: usdt,
          network: 'TRC20',
          lines: [
            'Depuis ton portefeuille (Trust Wallet, OKX, Bybit…) : Envoyer → USDT → réseau TRON (TRC20). Scanne le QR code ou colle l’adresse.',
            'Envoie le montant exact, frais de réseau à ta charge. N’utilise QUE le réseau TRC20 : sur un autre réseau, les fonds sont perdus.',
            `${proof} (garde l’identifiant de transaction).`,
          ],
        } : undefined,
        lines: [
          'Dans Binance : Payer → Envoyer → Binance Pay ID, colle l’ID ci-dessus et vérifie le nom.',
          'Envoie le montant exact et colle la référence dans la note.',
          `${proof} : ta commande est validée et ton accès arrive par e-mail.`,
        ],
      },
    }
  },
}
