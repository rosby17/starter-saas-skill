import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { creditPaidOrder } from '@/lib/orders/credit-order'
import { gatewayForPaymentMethod } from '@/lib/payments/gateways'

export const dynamic = 'force-dynamic'

/**
 * Actions admin sur une commande : POST { action: 'verify' | 'mark_paid' | 'mark_failed' }
 *  - verify      : interroge la passerelle (si elle sait répondre) et crédite si le paiement est confirmé ;
 *  - mark_paid   : paiement vérifié par un humain (ex. Binance manuel) → crédit atomique ; avec le détail pour la
 *                  comptabilité : { method, ref, amount_fcfa, note } (moyen réel, référence, montant reçu) ;
 *  - mark_failed : abandonne une commande en attente.
 * Un « flagged_* » (remboursement, montant insuffisant) ne peut pas être crédité d'ici : il se règle en base, à la main.
 * Chaque action est écrite dans admin_audit_log.
 */
const paidSchema = z.object({
  method: z.string().trim().min(2).max(60).optional(),
  ref: z.string().trim().max(200).optional(),
  amount_fcfa: z.number().int().min(0).max(100_000_000).optional(),
  note: z.string().trim().max(500).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { action } = body as { action?: string }
  const db = serviceClient()

  const { data: order } = await db.from('orders').select('*').eq('id', id).maybeSingle()
  if (!order) return NextResponse.json({ success: false, message: 'Commande introuvable.' }, { status: 404 })

  // Annuler une commande abandonnée : le client est parti, elle sort de la liste courante.
  if (action === 'cancel') {
    const { data } = await db.from('orders').update({ status: 'cancelled' }).eq('id', id).in('status', ['pending', 'failed', 'expired']).select('id')
    await logAdminAction(db, auth.userId, 'order.cancel', { type: 'order', id }, { changed: !!data?.length })
    return NextResponse.json({ success: true, changed: !!data?.length, message: data?.length ? 'Commande annulée.' : 'Rien à annuler.' })
  }

  // Commande de test (bac à sable) : jamais comptée dans les ventes. Ne retire pas l'accès éventuel.
  if (action === 'mark_test' || action === 'unmark_test') {
    await db.from('orders').update({ is_test: action === 'mark_test' }).eq('id', id)
    await logAdminAction(db, auth.userId, `order.${action}`, { type: 'order', id })
    return NextResponse.json({ success: true, message: action === 'mark_test' ? 'Commande marquée comme test : elle ne compte plus dans les ventes.' : 'Commande comptée à nouveau dans les ventes.' })
  }

  if (action === 'mark_failed') {
    const { data } = await db.from('orders').update({ status: 'failed' }).eq('id', id).eq('status', 'pending').select('id')
    await logAdminAction(db, auth.userId, 'order.mark_failed', { type: 'order', id }, { changed: !!data?.length })
    return NextResponse.json({ success: true, changed: !!data?.length })
  }

  if (action === 'mark_paid') {
    const parsed = paidSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? 'Détail du paiement invalide.' }, { status: 400 })
    const d = parsed.data
    // Le détail est écrit AVANT le crédit : il reste visible même si la livraison doit être relancée.
    const { error } = await db.from('orders').update({
      payment_method: d.method ?? order.payment_method,
      payment_ref: d.ref || order.payment_ref,
      paid_amount_fcfa: d.amount_fcfa ?? order.amount_fcfa,
      payment_note: d.note || null,
      paid_at: new Date().toISOString(),
      validated_by: auth.userId,
    }).eq('id', id).neq('status', 'success')
    if (error) return NextResponse.json({ success: false, message: 'Détail du paiement non enregistré.' }, { status: 500 })
    // Commande annulée puis payée quand même : elle redevient livrable (la livraison n'accepte que pending / failed / expired).
    if (order.status === 'cancelled') await db.from('orders').update({ status: 'failed' }).eq('id', id).eq('status', 'cancelled')
    const credited = await creditPaidOrder(db, order, d.ref || order.payment_ref)
    await logAdminAction(db, auth.userId, 'order.mark_paid', { type: 'order', id }, { credited, credits: order.credits, user_id: order.user_id })
    return NextResponse.json({ success: true, credited, message: credited ? 'Commande validée : accès donné au client (e-mail d’accès envoyé si Brevo est configuré).' : "Rien à valider (déjà payée, ou statut qui exige un examen à la main)." })
  }

  if (action === 'verify') {
    const gateway = gatewayForPaymentMethod(order.payment_method)
    if (!gateway?.checkStatus) return NextResponse.json({ success: false, message: "Cette passerelle ne permet pas de vérifier : attends son webhook, ou utilise « Marquer payée » après contrôle." }, { status: 400 })
    const state = await gateway.checkStatus({ id: order.id, payment_ref: order.payment_ref })
    const credited = state === 'paid' ? await creditPaidOrder(db, order) : false
    await logAdminAction(db, auth.userId, 'order.verify', { type: 'order', id }, { state, credited })
    return NextResponse.json({ success: true, state, credited })
  }

  return NextResponse.json({ success: false, message: 'Action inconnue.' }, { status: 400 })
}
