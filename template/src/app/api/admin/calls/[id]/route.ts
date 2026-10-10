import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { slotLabel, validSlot } from '@/lib/calls/slots'
import { notifyCallClient } from '@/lib/calls/notify'
import { TZ_LABEL } from '@/lib/time'

// Administrateur : accepte un créneau du client (avec le lien de l'appel), propose un autre créneau, termine ou annule.
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm'), slot: z.string().max(40), meet_url: z.string().trim().max(500).optional(), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal('counter'), slot: z.string().max(40), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal('done') }),
  z.object({ action: z.literal('cancel'), note: z.string().trim().max(1000).optional() }),
])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Action invalide.' }, { status: 400 })
  const db = serviceClient()
  const { data: b } = await db.from('call_bookings').select('user_id, product_id, slots, status').eq('id', id).maybeSingle()
  if (!b) return NextResponse.json({ success: false, message: 'Appel introuvable.' }, { status: 404 })
  const op = parsed.data
  const now = new Date().toISOString()
  if (op.action === 'confirm' && op.meet_url && !/^https:\/\//.test(op.meet_url)) return NextResponse.json({ success: false, message: 'Lien de l’appel : https://…' }, { status: 400 })

  if (op.action === 'confirm') {
    const slot = new Date(op.slot).toISOString()
    if (!(b.slots as string[]).map((s) => new Date(s).toISOString()).includes(slot)) return NextResponse.json({ success: false, message: 'Ce créneau n’a pas été proposé par le client.' }, { status: 400 })
    await db.from('call_bookings').update({ status: 'confirmed', scheduled_at: slot, meet_url: op.meet_url || null, admin_note: op.note || null, updated_at: now }).eq('id', id)
    await notifyCallClient(db, b.user_id, b.product_id, '✅ Ton appel est confirmé', `Rendez-vous ${slotLabel(slot)} (${TZ_LABEL}).${op.meet_url ? `\nLien de l’appel : ${op.meet_url}` : ''}${op.note ? `\n${op.note}` : ''}`)
  } else if (op.action === 'counter') {
    const slot = new Date(op.slot).toISOString()
    if (!validSlot(slot)) return NextResponse.json({ success: false, message: 'Créneau impossible (au moins 12 h à l’avance, à l’heure pile d’un horaire proposé).' }, { status: 400 })
    await db.from('call_bookings').update({ status: 'counter', counter_at: slot, admin_note: op.note || null, updated_at: now }).eq('id', id)
    await notifyCallClient(db, b.user_id, b.product_id, '📅 Je te propose un autre créneau', `Je ne suis pas disponible à tes horaires. Je te propose ${slotLabel(slot)} (${TZ_LABEL}). Accepte-le ou propose d’autres créneaux dans ton espace.${op.note ? `\n${op.note}` : ''}`)
  } else if (op.action === 'done') {
    await db.from('call_bookings').update({ status: 'done', updated_at: now }).eq('id', id)
  } else {
    await db.from('call_bookings').update({ status: 'cancelled', admin_note: op.note || null, updated_at: now }).eq('id', id)
    await notifyCallClient(db, b.user_id, b.product_id, 'Ton appel est annulé', `${op.note ? `${op.note}\n` : ''}Ton heure reste disponible : propose de nouveaux créneaux dans ton espace.`)
  }
  await logAdminAction(db, auth.userId, `call.${op.action}`, { type: 'call_booking', id })
  return NextResponse.json({ success: true })
}
