import type { SupabaseClient } from '@supabase/supabase-js'
import { creditPaidOrder, type OrderRow } from '@/lib/orders/credit-order'

type Order = OrderRow & { status: string; amount_usd?: number | null; amount_fcfa?: number | null }

/**
 * Applique à une commande un paiement CONFIRMÉ par la passerelle : vérifie que le montant reçu couvre le montant dû
 * (tolérance 2 %), puis livre la commande (atomique : jamais deux fois). Un montant insuffisant ne livre rien :
 * la commande passe en « flagged_underpaid » pour vérification manuelle.
 * `currency` : unité du montant reçu — « fcfa » (montant demandé à la passerelle, orders.amount_fcfa) ou « usd ».
 */
export async function settlePaid(
  supabase: SupabaseClient,
  order: Order,
  paidAmount: number | null,
  currency: 'fcfa' | 'usd',
  label: string
): Promise<'success' | 'flagged_underpaid'> {
  const expected = Number(currency === 'usd' ? order.amount_usd : (order.amount_fcfa ?? order.amount_local)) || 0
  const tolerance = Math.max(expected * 0.02, currency === 'usd' ? 0.5 : 5)
  if (paidAmount !== null && Number.isFinite(paidAmount) && expected > 0 && paidAmount < expected - tolerance) {
    console.error(`[ACTION REQUISE] ${label} : commande ${order.id} payée ${paidAmount} pour ${expected} dus. Rien n'a été livré : vérification manuelle.`)
    const { error } = await supabase.from('orders').update({ status: 'flagged_underpaid' }).eq('id', order.id).in('status', ['pending', 'failed', 'expired'])
    if (error) console.error(`[ACTION REQUISE] Commande ${order.id} non marquée « montant insuffisant » :`, error.message)
    return 'flagged_underpaid'
  }
  await creditPaidOrder(supabase, order, `via ${label}`)
  return 'success'
}

export async function markFailed(supabase: SupabaseClient, orderId: string) {
  const { error } = await supabase.from('orders').update({ status: 'failed' }).eq('id', orderId).eq('status', 'pending')
  if (error) console.error(`Commande ${orderId} non marquée « échouée » :`, error.message)
}
