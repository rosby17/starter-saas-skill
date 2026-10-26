import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { coachConfigured } from '@/lib/coach/ai'
import { readDaily, writeDaily } from '@/lib/coach/daily'
import { deleteClientReply, saveClientReply } from '@/lib/coach/replies'
import { readCoachSettings } from '@/lib/coach/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const postSchema = z.object({
  userId: z.string().uuid(),
  text: z.string().trim().min(2).max(3000),
  action: z.string().max(300).nullish(),
})

/** Réponse d'un client contacté : enregistrée, analysée tout de suite, et le client est marqué « contacté ». */
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const input = postSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({ success: false, message: 'La réponse doit contenir entre 2 et 3 000 caractères.' }, { status: 400 })
  const db = serviceClient()
  try {
    // Sans moteur IA, la réponse est gardée sans analyse (elle servira au prochain point du jour).
    const reply = await saveClientReply(db, await readCoachSettings(db), input.data.userId, input.data.text, input.data.action ?? null, coachConfigured())
    const daily = await readDaily(db)
    let contacted: Record<string, string> | null = null
    if (daily && !daily.contacted[input.data.userId]) {
      contacted = { ...daily.contacted, [input.data.userId]: reply.at }
      await writeDaily(db, { ...daily, contacted })
    }
    return NextResponse.json({ success: true, reply, contacted })
  } catch (error) {
    console.error('[coach]', error)
    return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 500 })
  }
}

const deleteSchema = z.object({ userId: z.string().uuid(), at: z.string().min(10).max(40) })

/** Retirer une réponse saisie par erreur. */
export async function DELETE(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const input = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({ success: false, message: 'Requête invalide.' }, { status: 400 })
  try {
    await deleteClientReply(serviceClient(), input.data.userId, input.data.at)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[coach]', error)
    return NextResponse.json({ success: false, message: 'Suppression impossible.' }, { status: 500 })
  }
}
