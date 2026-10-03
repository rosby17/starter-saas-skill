import type { PaymentGateway } from '../types'
import { maketou } from './maketou'
import { taramoney } from './taramoney'

// Enregistre ici chaque nouvelle passerelle.
const GATEWAYS: Record<string, PaymentGateway> = {
  [maketou.id]: maketou,
  [taramoney.id]: taramoney,
}

export const getGateway = (id: string): PaymentGateway | null => GATEWAYS[id] ?? null
