import type { PaymentCategoryId } from './providers'

/** Ce que le client paie : un produit du catalogue, au prix calculé côté serveur. */
export type CheckoutItem = {
  id: string
  name: string
  /** Prix en FCFA (devise du site). */
  amountLocal: number
  /** Équivalent en USD (passerelles qui facturent en dollars, ex. Binance). */
  amountUsd: number
}

export type CheckoutInput = {
  orderId: string
  plan: CheckoutItem
  currency: string
  customer: { email: string; firstName: string; lastName: string; phone?: string }
  /** Montant en FCFA, déjà converti (les passerelles africaines facturent en FCFA). */
  amountFcfa: number
  /** Adresse publique du site, sans « / » final. */
  origin: string
  /** Type de paiement choisi par le client (certaines passerelles adaptent leur page : carte directe, etc.). */
  paymentType: PaymentCategoryId
}

export type CheckoutResult = {
  /** Absent pour un paiement manuel (ex. Binance) : le client reçoit des instructions au lieu d'être redirigé. */
  redirectUrl?: string
  /** Instructions de paiement manuel affichées au client. */
  manual?: {
    title: string
    lines: string[]
    /** Montant mis en avant, ID et référence copiables d'un clic, bouton WhatsApp pré-rempli. */
    amount?: string
    amountNote?: string
    payId?: string
    payIdLabel?: string
    /** Autre façon de payer dans le même panneau (ex. USDT TRC20 depuis n'importe quel portefeuille, avec QR code). */
    alt?: { tab: string; label: string; address: string; network: string; lines: string[] }
    /** Libellé de l'onglet principal quand il y a une autre façon de payer. */
    tab?: string
    reference?: string
    whatsappUrl?: string
  }
  /** Référence chez la passerelle ; sert à retrouver la commande. */
  providerRef: string
  /** Certaines passerelles imposent leur propre identifiant de commande : il remplace orderId. */
  orderId?: string
}

// Contrat commun : une passerelle = un fichier dans gateways/ qui l'implémente.
export interface PaymentGateway {
  id: string
  /** Texte enregistré dans orders.payment_method. */
  paymentMethod: string
  /** false si les clés d'environnement manquent : le checkout répond alors proprement. */
  isConfigured(): boolean
  /** Facultatif : la passerelle accepte-t-elle la clé ? (false = refusée, null = impossible à savoir) */
  checkKey?(): Promise<boolean | null>
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>
  /** Facultatif : interroge la passerelle (celles qui n'ont pas de webhook). 'unknown' = pas de réponse exploitable. */
  checkStatus?(order: { id: string; payment_ref: string | null }): Promise<'paid' | 'pending' | 'unknown'>
}

export class GatewayError extends Error {
  constructor(message: string, public status = 502) {
    super(message)
  }
}
