import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { clearOrderCookie, readOrderCookie } from '@/lib/orders/order-cookie'
import { createLoginLink } from '@/lib/auth/access-link'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * « Accéder maintenant » après un achat sans compte : ouvre la session du client SANS passer par sa boîte mail,
 * uniquement si les trois conditions sont réunies :
 *   - ce navigateur a lancé la commande (cookie signé) ;
 *   - la commande est payée ;
 *   - le compte a été CRÉÉ par cet achat (sinon, quelqu'un pourrait entrer dans le compte existant d'un autre
 *     simplement en payant avec son e-mail : dans ce cas, le lien part par e-mail).
 */
export async function POST(request: Request) {
  if (!checkRateLimit(`enter:${clientIp(request)}`, 10, 60_000).success) {
    return NextResponse.json({ success: false, message: 'Trop de tentatives.' }, { status: 429 })
  }
  const { cartId } = await request.json().catch(() => ({}))
  const cookieOrderId = await readOrderCookie()
  if (!cookieOrderId || cookieOrderId !== cartId) {
    return NextResponse.json({ success: false, message: 'Ouvre le lien reçu par e-mail pour accéder à ton espace.' }, { status: 403 })
  }

  const { data: { user } } = await (await createClient()).auth.getUser()
  const db = serviceClient()
  const { data: order } = await db.from('orders').select('user_id, status, new_account, customer_email').eq('id', cookieOrderId).maybeSingle()
  if (!order || order.status !== 'success' || !order.new_account) {
    return NextResponse.json({ success: false, message: 'Ouvre le lien reçu par e-mail pour accéder à ton espace.' }, { status: 403 })
  }
  if (user?.id === order.user_id) return NextResponse.json({ success: true, url: '/mes-achats' })

  const { data: buyer } = await db.auth.admin.getUserById(order.user_id)
  const email = buyer?.user?.email
  const url = email ? await createLoginLink(db, email, '/mes-achats') : null
  if (!url) return NextResponse.json({ success: false, message: 'Ouvre le lien reçu par e-mail pour accéder à ton espace.' }, { status: 500 })
  await clearOrderCookie() // usage unique depuis ce navigateur
  return NextResponse.json({ success: true, url })
}
