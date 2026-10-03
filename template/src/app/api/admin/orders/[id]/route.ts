import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { creditPaidOrder } from '@/lib/orders/credit-order'
import { gatewayForPaymentMethod } from '@/lib/payments/gateways'

export const dynamic = 'force-dynamic'

/**
 * Actions admin sur une commande : POST { action: 'verify' | 'mark_paid' | 'mark_failed' }
 *  - verify      : interroge la passerelle (si elle sait répondre) et crédite si le paiement est confirmé ;
 *  - mark_paid   : paiement vérifié par un humain (ex. Binance manuel) → crédit atomique ;
 *  - mark_failed : abandonne une commande en attente.
 * Un « flagged_* » (remboursement, montant insuffisant) ne peut pas être crédité d'ici : il se règle en base, à la main.
 * Chaque action est écrite dans admin_audit_log.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error

  const { id } = await params
  const { action } = await request.json().catch(() => ({}))
  const db = serviceClient()

  const { data: order } = await db.from('orders').select('*').eq('id', id).maybeSingle()
  if (!order) return NextResponse.json({ success: false, message: 'Commande introuvable.' }, { status: 404 })

  if (action === 'mark_failed') {
    const { data } = await db.from('orders').update({ status: 'failed' }).eq('id', id).eq('status', 'pending').select('id')
    await logAdminAction(db, auth.userId, 'order.mark_failed', { type: 'order', id }, { changed: !!data?.length })
    return NextResponse.json({ success: true, changed: !!data?.length })
  }

  if (action === 'mark_paid') {
    const credited = await creditPaidOrder(db, order, order.payment_ref)
    await logAdminAction(db, auth.userId, 'order.mark_paid', { type: 'order', id }, { credited, credits: order.credits, user_id: order.user_id })
    return NextResponse.json({ success: true, credited, message: credited ? 'Commande créditée.' : "Rien à créditer (déjà payée, ou statut qui exige un examen à la main)." })
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
