import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hmacHex, safeEqual } from '@/lib/payments/signature'
import { fetchGeniusPayPayment, settleGeniusPayOrder } from '@/lib/payments/geniuspay-settle'

// GeniusPay signe : HMAC-SHA256(horodatage + "." + corps brut). On ne se fie PAS au contenu du webhook : on relit le paiement
// par l'API de GeniusPay (source de vérité) avant de livrer.
export async function POST(request: Request) {
  try {
    const secret = process.env.GENIUSPAY_WEBHOOK_SECRET
    if (!secret) return NextResponse.json({ success: false, message: 'Webhook misconfigured' }, { status: 500 })
    const raw = await request.text()
    const signature = request.headers.get('x-webhook-signature') || ''
    const timestamp = request.headers.get('x-webhook-timestamp') || ''
    const event = request.headers.get('x-webhook-event') || ''
    if (!signature || !timestamp || !safeEqual(signature, hmacHex(secret, `${timestamp}.${raw}`))) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) {
      return NextResponse.json({ success: false, message: 'Timestamp too old' }, { status: 400 })
    }
    if (event === 'webhook.test') return NextResponse.json({ success: true })
    if (!event.startsWith('payment.')) return NextResponse.json({ success: true, message: 'Event ignored.' })

    const data = JSON.parse(raw)?.data
    const orderId = data?.metadata?.order_id
    if (!data?.reference || !orderId) return NextResponse.json({ success: false, message: 'Missing reference or order_id' }, { status: 400 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: order } = await supabase.from('orders').select('*').eq('id', String(orderId)).maybeSingle()
    if (!order || order.payment_ref !== data.reference) return NextResponse.json({ success: true, message: 'Order not found.' })

    const payment = await fetchGeniusPayPayment(data.reference)
    if (!payment) return NextResponse.json({ success: false, message: 'Could not confirm payment status' }, { status: 500 })
    await settleGeniusPayOrder(supabase, order, payment)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('GeniusPay webhook error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
