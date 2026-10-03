import type { PaymentGateway } from '../types'
import { maketou } from './maketou'
import { taramoney } from './taramoney'

// Enregistre ici chaque nouvelle passerelle.
const GATEWAYS: Record<string, PaymentGateway> = {
  [maketou.id]: maketou,
  [taramoney.id]: taramoney,
}

export const getGateway = (id: string): PaymentGateway | null => GATEWAYS[id] ?? null

// Retrouve la passerelle d'une commande d'après orders.payment_method (pour vérifier / rattraper un paiement).
export const gatewayForPaymentMethod = (method: string | null): PaymentGateway | null =>
  Object.values(GATEWAYS).find((g) => g.paymentMethod === method) ?? null
