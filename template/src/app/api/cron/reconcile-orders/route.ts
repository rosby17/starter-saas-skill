import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { acquireCronLock, releaseCronLock } from '@/lib/cron-lock'
import { serviceClient } from '@/lib/auth/service-client'
import { creditPaidOrder } from '@/lib/orders/credit-order'
import { expirePendingOrders } from '@/lib/orders/expire-pending'
import { gatewayForPaymentMethod } from '@/lib/payments/gateways'
import { settlePaid } from '@/lib/payments/settle'

export const dynamic = 'force-dynamic'

/**
 * Rattrapage des paiements (toutes les 15 min, Authorization: Bearer $CRON_SECRET) : pour les commandes récentes
 * non livrées, relit la passerelle quand elle le permet (client qui a fermé l'onglet, webhook perdu) et livre
 * celles qui sont payées ; puis expire les commandes abandonnées. Livraison atomique : jamais deux fois.
 * BORNÉ : Cloudflare coupe toute réponse au-delà de ~100 s (524). Le passage s'arrête après 45 s de travail (les plus
 * récentes d'abord, le reste au passage suivant) et chaque lecture d'une passerelle a 6 s au plus.
 */
const TIME_BUDGET_MS = 45_000
const CALL_TIMEOUT_MS = 6_000
const MAX_ORDERS = 200
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response('Unauthorized', { status: 401 })
  if (!(await acquireCronLock('reconcile-orders'))) return NextResponse.json({ success: true, skipped: 'already running' })
  try {
    const startedAt = Date.now()
    const db = serviceClient()
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const { data: orders } = await db.from('orders').select('*').in('status', ['pending', 'failed']).gte('created_at', since).order('created_at', { ascending: false }).limit(MAX_ORDERS)
    let delivered = 0
    let checked = 0
    let stoppedByBudget = false
    for (const order of orders ?? []) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) { stoppedByBudget = true; break }
      checked++
      try {
        const gateway = gatewayForPaymentMethod(order.payment_method)
        if (gateway?.checkStatus) {
          if ((await gateway.checkStatus({ id: order.id, payment_ref: order.payment_ref })) === 'paid' && (await creditPaidOrder(db, order))) delivered++
        } else if (order.payment_method === 'Warappay' && process.env.WARAPPAY_API_KEY) {
          const res = await fetch(`https://api.warappay.com/api/v1/checkout/${order.payment_ref || order.id}`, { headers: { Authorization: `Bearer ${process.env.WARAPPAY_API_KEY}` }, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) })
          if (res.ok) {
            const data = await res.json()
            if (data.status === 'completed' && (await settlePaid(db, order, Number(data.amount), 'fcfa', 'Warappay')) === 'success') delivered++
          }
        }
      } catch (error) {
        console.error(`Rattrapage de la commande ${order.id} impossible :`, error)
      }
    }
    const { expiredCount } = await expirePendingOrders(db)
    return NextResponse.json({ success: true, checked, delivered, expired: expiredCount, ...(stoppedByBudget ? { rest: 'repris au passage suivant (45 s atteintes)' } : {}) })
  } catch (error) {
    console.error('reconcile-orders :', error)
    return NextResponse.json({ success: false }, { status: 500 })
  } finally {
    await releaseCronLock('reconcile-orders')
  }
}
