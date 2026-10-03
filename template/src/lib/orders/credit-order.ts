import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/brevo'
import { rechargeConfirmationTemplate } from '@/lib/email/templates'

export type OrderRow = {
  id: string
  user_id: string
  plan_name: string | null
  credits: number
  amount_local: number | null
  currency: string | null
}

/**
 * Marque la commande payée ET crédite l'utilisateur, en UNE opération atomique côté base
 * (fonction SQL credit_paid_order, voir migration 0004). Renvoie true seulement si CET appel a crédité :
 * webhook, retour du client, cron et action admin peuvent se croiser sans jamais créditer deux fois.
 * Les commandes « flagged_* » (remboursement, montant insuffisant) ne sont jamais re-créditées.
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
    console.error(`[ACTION REQUIRED] Crédit impossible pour la commande ${order.id} (utilisateur ${order.user_id}) :`, error)
    return false
  }
  if (!credited) return false

  try {
    const { data: userData } = await supabase.auth.admin.getUserById(order.user_id)
    if (userData?.user?.email) {
      await sendEmail({
        to: { email: userData.user.email },
        subject: 'Ton achat est confirmé',
        html: rechargeConfirmationTemplate({
          credits: order.credits,
          amount: `${order.amount_local || 0} ${order.currency || 'XOF'}`,
          planName: order.plan_name || 'Crédits',
        }),
      })
    }
  } catch (emailErr) {
    console.error("Erreur d'envoi de l'e-mail de confirmation :", emailErr)
  }
  return true
}

/** Le montant réellement encaissé couvre-t-il le montant dû ? (tolérance 2 % pour les arrondis du fournisseur) */
export function paidAmountCoversOrder(paid: unknown, expected: number | null): boolean {
  const due = Number(expected) || 0
  const received = Number(paid)
  if (!Number.isFinite(received) || due <= 0) return true // le fournisseur ne donne pas le montant : on ne peut pas contrôler
  return received >= due - Math.max(due * 0.02, 5)
}
