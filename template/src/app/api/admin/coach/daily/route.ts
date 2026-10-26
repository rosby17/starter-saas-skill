import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { recordErrorLog } from '@/lib/monitoring/error-log'
import { coachConfigured } from '@/lib/coach/ai'
import { coachDay, generateDaily, isGeneratingDaily, readDaily, readIgnored, writeDaily, writeIgnored, type StoredDaily } from '@/lib/coach/daily'
import { offerLink, resolveContacts } from '@/lib/coach/contacts'
import { readReplies } from '@/lib/coach/replies'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Après un échec, pas de nouvel essai automatique avant 30 min (chaque essai est payant). */
const RETRY_AFTER_MS = 30 * 60 * 1000
let lastFailure: { at: number; message: string } | null = null

function startGeneration(userId: string) {
  after(async () => {
    try {
      await generateDaily(serviceClient())
      lastFailure = null
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erreur inconnue'
      lastFailure = { at: Date.now(), message }
      console.error('[coach] point du jour impossible', message)
      await recordErrorLog({
        userId, source: 'server', page: '/admin/coach', action: 'coach-daily', httpStatus: 502, errorMessage: message,
        details: { kind: 'coach-ai', cause: "Le coach n'a pas pu produire le point du jour.", fix: 'Vérifier ANTHROPIC_API_KEY (crédits, validité) et COACH_MODEL dans Clés et intégrations ; KIE_API_KEY sert de secours.' },
      })
    }
  })
}

/** Point du jour. S'il date d'hier ou n'existe pas, l'analyse est lancée en arrière-plan ; la page revient la chercher. */
export async function GET() {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const db = serviceClient()
  const daily = await readDaily(db)
  const configured = coachConfigured()
  const recentFailure = lastFailure && Date.now() - lastFailure.at < RETRY_AFTER_MS ? lastFailure : null
  const stale = daily?.day !== coachDay()
  if (configured && stale && !isGeneratingDaily() && !recentFailure) startGeneration(guard.userId)
  try {
    return NextResponse.json({
      success: true,
      configured,
      daily,
      contacts: daily ? await resolveContacts(db, daily, await readIgnored(db), await readReplies(db)) : {},
      offerLink: offerLink(),
      stale,
      generating: isGeneratingDaily() || (configured && stale && !recentFailure),
      failure: recentFailure?.message ?? null,
    })
  } catch (error) {
    console.error('[coach]', error)
    return NextResponse.json({ success: false, message: 'Lecture du point du jour impossible.' }, { status: 500 })
  }
}

/** « Refaire l'analyse » : nouvelle analyse, à la demande. */
export async function POST() {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  if (!coachConfigured()) return NextResponse.json({ success: false, message: 'Coach éteint : ajoutez la clé Anthropic dans Clés et intégrations.' }, { status: 503 })
  if (!isGeneratingDaily()) {
    lastFailure = null
    startGeneration(guard.userId)
  }
  return NextResponse.json({ success: true, generating: true })
}

const patchSchema = z.union([
  z.object({ action: z.number().int().min(0).max(10), done: z.boolean() }),
  z.object({ contacted: z.string().uuid(), value: z.boolean() }),
  z.object({ ignore: z.string().uuid(), value: z.boolean() }),
])

/** Cases « Fait » (action), « Contacté » et « Ignorer » (client) : le point du lendemain en tient compte. */
export async function PATCH(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const input = patchSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({ success: false, message: 'Requête invalide.' }, { status: 400 })
  const db = serviceClient()
  const now = new Date().toISOString()
  try {
    if ('ignore' in input.data) {
      // Écarté durablement : ni dans les listes, ni dans les groupes comptés pour le coach.
      const ignored = await readIgnored(db)
      if (input.data.value) ignored[input.data.ignore] = now
      else delete ignored[input.data.ignore]
      await writeIgnored(db, ignored)
      return NextResponse.json({ success: true, ignored })
    }
    const daily = await readDaily(db)
    if (!daily) return NextResponse.json({ success: false, message: 'Pas de point du jour.' }, { status: 404 })
    const next: StoredDaily = { ...daily, done: { ...daily.done }, contacted: { ...daily.contacted } }
    if ('action' in input.data) {
      if (input.data.done) next.done[String(input.data.action)] = now
      else delete next.done[String(input.data.action)]
    } else if (input.data.value) next.contacted[input.data.contacted] = now
    else delete next.contacted[input.data.contacted]
    await writeDaily(db, next)
    return NextResponse.json({ success: true, done: next.done, contacted: next.contacted })
  } catch (error) {
    console.error('[coach]', error)
    return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 500 })
  }
}
