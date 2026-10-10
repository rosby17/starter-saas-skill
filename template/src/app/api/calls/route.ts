import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { checkRateLimit } from '@/lib/rate-limit'
import { callCredits } from '@/lib/calls/credits'
import { MAX_SLOTS, slotLabel, validSlot } from '@/lib/calls/slots'
import { notifyAdmin } from '@/lib/orders/deliver'

// Le client propose ses créneaux : nouvel appel (s'il lui reste un appel payé) ou nouvelle proposition sur un appel existant.
const schema = z.object({
  bookingId: z.string().uuid().optional(),
  slots: z.array(z.string().max(40)).min(1).max(MAX_SLOTS),
  topic: z.string().trim().max(2000).default(''),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, message: 'Connecte-toi.' }, { status: 401 })
  if (!checkRateLimit(`calls:${user.id}`, 10, 60 * 60_000).success) return NextResponse.json({ success: false, message: 'Trop d’essais : réessaie plus tard.' }, { status: 429 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Choisis au moins un créneau.' }, { status: 400 })
  const slots = [...new Set(parsed.data.slots.map((s) => new Date(s).toISOString()))].sort()
  if (slots.some((s) => !validSlot(s))) return NextResponse.json({ success: false, message: 'Un créneau n’est plus possible (au moins 12 h à l’avance, 60 jours au plus).' }, { status: 400 })

  const db = serviceClient()
  const { product, left } = await callCredits(db, user.id)
  if (!product) return NextResponse.json({ success: false, message: 'Offre introuvable.' }, { status: 404 })
  let id = parsed.data.bookingId
  if (id) {
    const { data, error } = await db.from('call_bookings').update({ slots, topic: parsed.data.topic, status: 'proposed', counter_at: null, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id).in('status', ['proposed', 'counter']).select('id')
    if (error || !data?.length) return NextResponse.json({ success: false, message: 'Cet appel ne peut plus être modifié.' }, { status: 409 })
  } else {
    if (left < 1) return NextResponse.json({ success: false, message: 'Tu n’as plus d’appel à réserver : prends une nouvelle heure dans la boutique.' }, { status: 409 })
    const { data, error } = await db.from('call_bookings').insert({ user_id: user.id, product_id: product.id, slots, topic: parsed.data.topic }).select('id').single()
    if (error || !data) return NextResponse.json({ success: false, message: 'Réservation non enregistrée.' }, { status: 500 })
    id = data.id
  }
  const { data: profile } = await db.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle()
  await notifyAdmin('📅 Demande d’appel à confirmer', [
    `Client : ${profile?.full_name ?? '—'} · ${user.email} · ${profile?.phone ?? '—'}`,
    `Créneaux proposés : ${slots.map(slotLabel).join(' ; ')}`,
    parsed.data.topic ? `Sujet : ${parsed.data.topic.slice(0, 400)}` : '',
  ].filter(Boolean), '/admin/appels')
  return NextResponse.json({ success: true, id })
}
