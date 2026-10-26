import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { coachConfigured, coachModel } from '@/lib/coach/ai'
import { coachSettingsSchema, readCoachSettings, writeCoachSettings } from '@/lib/coach/settings'

export const dynamic = 'force-dynamic'

/** Réglages du coach, PRÉ-REMPLIS avec les valeurs en place (ou celles de site.ts). */
export async function GET() {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  return NextResponse.json({ success: true, settings: await readCoachSettings(serviceClient()), configured: coachConfigured(), model: coachModel() })
}

/** Seuls les champs envoyés changent ; le reste garde sa valeur. */
export async function PATCH(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const patch = coachSettingsSchema.partial().safeParse(await request.json().catch(() => null))
  if (!patch.success) return NextResponse.json({ success: false, message: patch.error.issues[0]?.message ?? 'Réglages invalides.' }, { status: 400 })
  const db = serviceClient()
  try {
    const settings = { ...(await readCoachSettings(db)), ...patch.data }
    await writeCoachSettings(db, settings)
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('[coach]', error)
    return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 500 })
  }
}
