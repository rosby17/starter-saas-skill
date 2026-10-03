import type { BillingPlan } from '@/lib/pricing'

export type CheckoutInput = {
  orderId: string
  plan: BillingPlan
  currency: string
  customer: { email: string; firstName: string; lastName: string; phone?: string }
  /** Adresse publique du site, sans « / » final. */
  origin: string
}

export type CheckoutResult = {
  redirectUrl: string
  /** Référence chez la passerelle ; sert à retrouver la commande. */
  providerRef: string
  /** Certaines passerelles imposent leur propre identifiant de commande (ex. Maketou) : il remplace orderId. */
  orderId?: string
}

// Contrat commun : une passerelle = un fichier dans gateways/ qui l'implémente.
export interface PaymentGateway {
  id: string
  /** Texte enregistré dans orders.payment_method. */
  paymentMethod: string
  /** false si les clés d'environnement manquent : le checkout répond alors proprement. */
  isConfigured(): boolean
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>
  /** Facultatif : interroge la passerelle (celles qui n'ont pas de webhook). 'unknown' = pas de réponse exploitable. */
  checkStatus?(order: { id: string; payment_ref: string | null }): Promise<'paid' | 'pending' | 'unknown'>
}

export class GatewayError extends Error {
  constructor(message: string, public status = 502) {
    super(message)
  }
}
