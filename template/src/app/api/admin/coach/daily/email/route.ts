import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { readDaily, readIgnored, writeDaily } from '@/lib/coach/daily'
import { offerLink, resolveContacts } from '@/lib/coach/contacts'
import { fillCoachMessage } from '@/lib/coach/message'
import { emailSignature, readCoachSettings } from '@/lib/coach/settings'
import { sendEmail } from '@/lib/email/brevo'
import { coachMessageTemplate } from '@/lib/email/templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Quota d'envoi (Brevo gratuit : 300 / jour pour tout le site) : on en garde pour les e-mails du compte. */
const MAX_PER_SEND = 100
const PAUSE_MS = 250

const bodySchema = z.object({
  action: z.number().int().min(0).max(10),
  userIds: z.array(z.string().uuid()).min(1).max(MAX_PER_SEND),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  lang: z.enum(['fr', 'en']).default('fr'),
})

/**
 * E-mail groupé du coach : seuls les clients de l'action, non écartés et pas encore relancés par e-mail
 * aujourd'hui, le reçoivent ; chacun est ensuite marqué « contacté ». Signature nominative ajoutée.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  const input = bodySchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({ success: false, message: 'Requête invalide.' }, { status: 400 })

  const db = serviceClient()
  const daily = await readDaily(db)
  if (!daily) return NextResponse.json({ success: false, message: 'Pas de point du jour.' }, { status: 404 })
  const action = daily.brief.actions[input.data.action]
  if (!action || action.kind !== 'contacter') return NextResponse.json({ success: false, message: "Cette action n'a pas de clients à contacter." }, { status: 400 })

  const settings = await readCoachSettings(db)
  const link = offerLink()
  const contacts = (await resolveContacts(db, daily, await readIgnored(db)))[String(input.data.action)] ?? []
  const wanted = new Set(input.data.userIds)
  const targets = contacts.filter((c) => wanted.has(c.userId) && c.email && !c.emailedAt)
  const withLink = input.data.body.includes('{lien}')
  const en = input.data.lang === 'en'

  const sent: string[] = []
  const failed: string[] = []
  for (const c of targets) {
    const ok = await sendEmail({
      to: { email: c.email!, name: c.name || undefined },
      subject: fillCoachMessage(input.data.subject, c.firstName, link),
      html: coachMessageTemplate({
        text: fillCoachMessage(input.data.body, c.firstName, link),
        ctaUrl: withLink ? link : null,
        ctaLabel: en ? 'See the offer' : 'Voir l’offre',
        lang: input.data.lang,
        signature: emailSignature(settings, input.data.lang),
      }),
      replyTo: settings.replyTo ? { email: settings.replyTo, name: settings.companyName } : undefined,
      template: 'coach-message',
      priority: 'low',
    })
    ;(ok ? sent : failed).push(c.userId)
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS))
  }

  // Relire avant d'écrire : une case cochée pendant l'envoi ne doit pas être perdue.
  const latest = (await readDaily(db)) ?? daily
  const now = new Date().toISOString()
  const emailed = { ...latest.emailed }
  const contacted = { ...latest.contacted }
  for (const id of sent) {
    emailed[id] = now
    contacted[id] = contacted[id] ?? now
  }
  try {
    await writeDaily(db, { ...latest, emailed, contacted })
  } catch (error) {
    console.error('[coach] suivi des envois non enregistré', error)
  }
  return NextResponse.json({ success: true, sent: sent.length, failed: failed.length, skipped: input.data.userIds.length - targets.length, emailed, contacted })
}
