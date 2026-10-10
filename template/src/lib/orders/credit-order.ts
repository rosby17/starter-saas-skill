import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyAdmin, productTitlesWithIncludes, sendAccessEmail } from '@/lib/orders/deliver'
import { formatOrderAmount } from '@/lib/pricing/zones'

export type OrderRow = {
  id: string
  user_id: string
  plan_name: string | null
  credits: number
  amount_local: number | null
  currency: string | null
  product_id?: string | null
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
}

/**
 * Livre une commande payée : la passe en « success » ET accorde l'accès au produit (et à ceux qu'il inclut),
 * en UNE opération atomique côté base (fonction SQL credit_paid_order). Renvoie true seulement si CET appel a livré :
 * webhook, retour du client, cron et action admin peuvent se croiser sans jamais livrer deux fois.
 * Les commandes « flagged_* » (remboursement, montant insuffisant) ne sont jamais livrées automatiquement.
 * Puis e-mail « Ton accès est prêt » avec lien de connexion directe, et alerte à l'administrateur.
 */
export async function creditPaidOrder(
  supabase: SupabaseClient,
  order: OrderRow,
  paymentRef?: string | null
): Promise<boolean> {
  const { data: credited, error } = await supabase.rpc('credit_paid_order', {
    p_order_id: order.id,
    p_payment_ref: paymentRef ?? null,
  })
  if (error) {
    // Rien n'a été modifié (transaction annulée) : la commande reste réessayable par le prochain passage.
    console.error(`[ACTION REQUISE] Livraison impossible pour la commande ${order.id} (client ${order.user_id}) :`, error)
    return false
  }
  if (!credited) return false
  // Date du paiement pour la facture (déjà posée par une validation manuelle).
  await supabase.from('orders').update({ paid_at: new Date().toISOString() }).eq('id', order.id).is('paid_at', null)

  // Relit la commande : les appelants ne passent pas toujours toutes les colonnes.
  const { data: full } = await supabase
    .from('orders')
    .select('product_id, plan_name, amount_local, currency, customer_name, customer_email, customer_phone, payment_method, purchase_kind')
    .eq('id', order.id)
    .maybeSingle()
  const amount = formatOrderAmount(full?.amount_local ?? order.amount_local, full?.currency)
  const titles = full?.product_id ? await productTitlesWithIncludes(supabase, full.product_id) : [full?.plan_name || order.plan_name || 'Ton achat']
  // Réservation : un seul titre (pas d'accès aux inclus) ; la facture est jointe dans tous les cas.
  await sendAccessEmail(supabase, order.user_id, full?.purchase_kind === 'deposit' ? titles.slice(0, 1) : titles, amount, order.id)
  await notifyAdmin(`${full?.purchase_kind === 'deposit' ? '📌 Nouvelle réservation' : full?.purchase_kind === 'balance' ? '🎉 Solde payé' : '🎉 Nouvelle vente'} : ${titles[0]}`, [
    `Montant : ${amount} (${full?.payment_method ?? '—'})`,
    `Client : ${full?.customer_name ?? '—'} · ${full?.customer_email ?? '—'} · ${full?.customer_phone ?? '—'}`,
  ], '/admin/orders')
  return true
}

/** Le montant réellement encaissé couvre-t-il le montant dû ? (tolérance 2 % pour les arrondis du fournisseur) */
export function paidAmountCoversOrder(paid: unknown, expected: number | null): boolean {
  const due = Number(expected) || 0
  const received = Number(paid)
  if (!Number.isFinite(received) || due <= 0) return true // le fournisseur ne donne pas le montant : on ne peut pas contrôler
  return received >= due - Math.max(due * 0.02, 5)
}
