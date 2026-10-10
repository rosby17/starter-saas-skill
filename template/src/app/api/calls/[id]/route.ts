import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { slotLabel } from '@/lib/calls/slots'
import { notifyAdmin } from '@/lib/orders/deliver'

// Le client accepte le créneau proposé par l'administrateur, ou annule sa demande (l'appel payé redevient disponible).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const parsed = z.object({ action: z.enum(['accept_counter', 'cancel']) }).safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false }, { status: 400 })
  const db = serviceClient()
  const { data: b } = await db.from('call_bookings').select('status, counter_at').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!b) return NextResponse.json({ success: false, message: 'Appel introuvable.' }, { status: 404 })
  const now = new Date().toISOString()
  if (parsed.data.action === 'accept_counter') {
    if (b.status !== 'counter' || !b.counter_at) return NextResponse.json({ success: false, message: 'Aucun créneau à accepter.' }, { status: 409 })
    await db.from('call_bookings').update({ status: 'confirmed', scheduled_at: b.counter_at, updated_at: now }).eq('id', id)
    await notifyAdmin('✅ Créneau accepté par le client', [`Appel confirmé : ${slotLabel(b.counter_at)}`, `Client : ${user.email}`], '/admin/appels')
    return NextResponse.json({ success: true, message: 'C’est confirmé.' })
  }
  if (!['proposed', 'counter'].includes(b.status)) return NextResponse.json({ success: false, message: 'Un appel confirmé s’annule avec moi sur WhatsApp.' }, { status: 409 })
  await db.from('call_bookings').update({ status: 'cancelled', updated_at: now }).eq('id', id)
  return NextResponse.json({ success: true, message: 'Demande annulée : ton appel reste disponible.' })
}
