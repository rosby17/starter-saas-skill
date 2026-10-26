import type { PaymentGateway } from '../types'
import { binance } from './binance'
import { maketou } from './maketou'
import { momoDirect } from './momo-direct'
import { taramoney } from './taramoney'
import { warappay } from './warappay'
import { wave } from './wave'

// Enregistre ici chaque nouvelle passerelle.
const GATEWAYS: Record<string, PaymentGateway> = {
  [taramoney.id]: taramoney,
  [warappay.id]: warappay,
  [maketou.id]: maketou,
  [binance.id]: binance,
  [wave.id]: wave,
  [momoDirect.id]: momoDirect,
}

export const getGateway = (id: string): PaymentGateway | null => GATEWAYS[id] ?? null

// Retrouve la passerelle d'une commande d'après orders.payment_method (pour vérifier / rattraper un paiement).
export const gatewayForPaymentMethod = (method: string | null): PaymentGateway | null =>
  Object.values(GATEWAYS).find((g) => g.paymentMethod === method) ?? null
