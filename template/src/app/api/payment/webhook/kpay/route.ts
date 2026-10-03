import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hmacHex, safeEqual } from '@/lib/payments/signature'
import { markFailed, settlePaid } from '@/lib/payments/settle'

// K-Pay signe ses webhooks : HMAC-SHA256 du corps brut (x-kpay-signature) ; l'événement est dans x-kpay-event.
export async function POST(request: Request) {
  try {
    const secret = process.env.KPAY_WEBHOOK_SECRET
    if (!secret) return NextResponse.json({ success: false, message: 'Webhook misconfigured' }, { status: 500 })
    const raw = await request.text()
    const signature = request.headers.get('x-kpay-signature') || ''
    if (!signature || !safeEqual(signature, hmacHex(secret, raw))) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const event = request.headers.get('x-kpay-event') || ''
    const payload = JSON.parse(raw)
    if (!payload.externalId) return NextResponse.json({ success: false, message: 'Missing externalId' }, { status: 400 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    if (event === 'payment.failed' || event === 'payment.cancelled') {
      await markFailed(supabase, payload.externalId)
      return NextResponse.json({ success: true })
    }
    if (event !== 'payment.completed') return NextResponse.json({ success: true, message: 'Event ignored.' })

    const { data: order } = await supabase.from('orders').select('*').eq('id', payload.externalId).maybeSingle()
    if (!order) return NextResponse.json({ success: true, message: 'Order not found.' })
    await settlePaid(supabase, order, Number(payload.amount), 'usd', 'K-Pay')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('K-Pay webhook error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
