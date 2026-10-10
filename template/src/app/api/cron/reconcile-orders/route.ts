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
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response('Unauthorized', { status: 401 })
  if (!(await acquireCronLock('reconcile-orders'))) return NextResponse.json({ success: true, skipped: 'already running' })
  try {
    const db = serviceClient()
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const { data: orders } = await db.from('orders').select('*').in('status', ['pending', 'failed']).gte('created_at', since).limit(200)
    let delivered = 0
    for (const order of orders ?? []) {
      try {
        const gateway = gatewayForPaymentMethod(order.payment_method)
        if (gateway?.checkStatus) {
          if ((await gateway.checkStatus({ id: order.id, payment_ref: order.payment_ref })) === 'paid' && (await creditPaidOrder(db, order))) delivered++
        } else if (order.payment_method === 'Warappay' && process.env.WARAPPAY_API_KEY) {
          const res = await fetch(`https://api.warappay.com/api/v1/checkout/${order.payment_ref || order.id}`, { headers: { Authorization: `Bearer ${process.env.WARAPPAY_API_KEY}` } })
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
    return NextResponse.json({ success: true, checked: orders?.length ?? 0, delivered, expired: expiredCount })
  } catch (error) {
    console.error('reconcile-orders :', error)
    return NextResponse.json({ success: false }, { status: 500 })
  } finally {
    await releaseCronLock('reconcile-orders')
  }
}
