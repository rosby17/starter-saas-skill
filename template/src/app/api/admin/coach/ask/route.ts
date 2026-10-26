import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { recordErrorLog } from '@/lib/monitoring/error-log'
import { askCoachModel, coachConfigured, parseJsonObject } from '@/lib/coach/ai'
import { coachPersona } from '@/lib/coach/persona'
import { clientMessageStyle, readCoachSettings } from '@/lib/coach/settings'
import { anonymizeForModel, buildCoachSnapshot } from '@/lib/coach/snapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({ question: z.string().trim().min(2).max(1200) })
const adviceSchema = z.object({
  answer: z.string().min(1),
  cards: z.array(z.object({ title: z.string().min(1), value: z.string().min(1), detail: z.string().min(1) })).max(6).catch([]),
  priorities: z.array(z.string()).max(5).catch([]),
  suggestedQuestions: z.array(z.string()).max(4).catch([]),
})

/** Question libre au coach, avec les données agrégées du SaaS (aucune identité de client). */
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const input = requestSchema.safeParse(await request.json().catch(() => ({})))
  if (!input.success) return NextResponse.json({ success: false, message: 'Votre question doit contenir entre 2 et 1 200 caractères.' }, { status: 400 })
  if (!coachConfigured()) return NextResponse.json({ success: false, message: 'Coach éteint : ajoutez la clé Anthropic dans Clés et intégrations.' }, { status: 503 })
  try {
    const db = serviceClient()
    const settings = await readCoachSettings(db)
    const data = anonymizeForModel(await buildCoachSnapshot(db, { goal: settings.monthlyGoal }))
    const prompt = `Réponds à la question du fondateur avec les données agrégées fournies. Ne prétends pas connaître ce qui n'y est pas, ne prédis jamais une conversion avec certitude. Les identités des clients ne sont pas disponibles.

Question : ${input.data.question}

Données actuelles : ${JSON.stringify(data)}

Réponds uniquement avec un JSON valide, sans Markdown : {"answer":"réponse claire et directe (3 à 6 phrases)","cards":[{"title":"titre court","value":"chiffre ou constat","detail":"interprétation actionnable"}],"priorities":["action prioritaire"],"suggestedQuestions":["question utile suivante"]}. Entre 2 et 4 cartes choisies selon la question.`
    const { text, failures } = await askCoachModel(`${coachPersona(settings)}\n\nSi tu rédiges un message pour un client : ${clientMessageStyle(settings)}`, prompt, { maxTokens: 8000 })
    const parsed = adviceSchema.safeParse(text ? parseJsonObject(text) : null)
    if (!parsed.success) {
      if (text) failures.push(`Réponse illisible (début : ${text.slice(0, 200)})`)
      await recordErrorLog({
        userId: guard.userId, source: 'server', page: '/admin/coach', action: 'POST /api/admin/coach/ask', httpStatus: 502,
        errorMessage: failures.join(' | ') || 'Aucune réponse du moteur IA',
        details: { kind: 'coach-ai', fix: 'Vérifier ANTHROPIC_API_KEY et COACH_MODEL ; KIE_API_KEY sert de secours.' },
      })
      return NextResponse.json({ success: false, message: `Le coach n'a pas pu répondre (${failures[0] || 'aucune réponse'}). Détail dans le journal d'erreurs.` }, { status: 502 })
    }
    return NextResponse.json({ success: true, advice: parsed.data })
  } catch (error) {
    console.error('[coach] question', error)
    return NextResponse.json({ success: false, message: "Le coach n'a pas pu terminer l'analyse. Réessayez dans un instant." }, { status: 500 })
  }
}
