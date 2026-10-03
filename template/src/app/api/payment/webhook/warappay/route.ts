import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hmacHex, safeEqual } from '@/lib/payments/signature'
import { markFailed, settlePaid } from '@/lib/payments/settle'

// Warappay signe ses webhooks : HMAC-SHA256 du corps brut, en-tête x-warappay-signature.
export async function POST(request: Request) {
  try {
    const secret = process.env.WARAPPAY_WEBHOOK_SECRET
    if (!secret) return NextResponse.json({ success: false, message: 'Webhook misconfigured' }, { status: 500 })
    const raw = await request.text()
    const signature = request.headers.get('x-warappay-signature') || ''
    if (!signature || !safeEqual(signature, hmacHex(secret, raw))) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const payload = JSON.parse(raw)
    const orderId = payload?.data?.meta?.order_id
    if (!orderId) return NextResponse.json({ success: false, message: 'Missing meta.order_id' }, { status: 400 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    if (payload.event === 'checkout.failed') {
      await markFailed(supabase, orderId)
      return NextResponse.json({ success: true })
    }
    if (payload.event !== 'checkout.completed') return NextResponse.json({ success: true, message: 'Event ignored.' })

    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
    if (!order) return NextResponse.json({ success: true, message: 'Order not found.' })
    await settlePaid(supabase, order, Number(payload.data.amount), 'local', 'Warappay')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Warappay webhook error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
