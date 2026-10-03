import type { SupabaseClient } from '@supabase/supabase-js'
import { GENIUSPAY_API, geniusPayHeaders } from './gateways/geniuspay'
import { markFailed, settlePaid } from './settle'
import type { OrderRow } from '@/lib/orders/credit-order'

export type GeniusPayPayment = { reference: string; amount: number; status: string }

/** État du paiement tel que GeniusPay le connaît (source de vérité). */
export async function fetchGeniusPayPayment(reference: string): Promise<GeniusPayPayment | null> {
  const response = await fetch(`${GENIUSPAY_API}/payments/${encodeURIComponent(reference)}`, { headers: geniusPayHeaders() })
  if (!response.ok) return null
  const body = await response.json().catch(() => null)
  return body?.success && body.data ? (body.data as GeniusPayPayment) : null
}

/** Applique l'état confirmé par GeniusPay. Partagé par le webhook et la vérification au retour du client. */
export async function settleGeniusPayOrder(
  supabase: SupabaseClient,
  order: OrderRow & { status: string },
  payment: GeniusPayPayment
): Promise<string> {
  const status = String(payment.status || '').toLowerCase()
  if (status === 'completed') return settlePaid(supabase, order, Number(payment.amount), 'fcfa', 'GeniusPay')
  if (['failed', 'cancelled', 'expired'].includes(status)) {
    await markFailed(supabase, order.id)
    return order.status === 'pending' ? 'failed' : order.status
  }
  return order.status
}
