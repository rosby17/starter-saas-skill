import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import { sendEmailDetailed } from '@/lib/email/brevo'
import { EMAIL_EXAMPLES } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// « M'envoyer un exemple de chaque e-mail » : chaque modèle, avec des données fictives, sujet préfixé « [Exemple] »,
// envoyé SEULEMENT à l'adresse de l'administrateur connecté. Rend le résultat de chaque envoi (vraie raison d'un échec).
export async function POST() {
  const guard = await requireAdmin()
  if (!guard.authorized) return guard.error
  if (!checkRateLimit(`email-examples:${guard.userId}`, 3, 10 * 60_000).success) {
    return NextResponse.json({ success: false, message: 'Déjà demandé 3 fois en 10 minutes : patiente un peu.' }, { status: 429 })
  }
  const db = serviceClient()
  const { data } = await db.auth.admin.getUserById(guard.userId)
  const email = data?.user?.email
  if (!email) return NextResponse.json({ success: false, message: 'Ton compte n’a pas d’adresse e-mail.' }, { status: 400 })

  const results = []
  for (const example of EMAIL_EXAMPLES) {
    try {
      const sent = await sendEmailDetailed({
        to: { email },
        subject: `[Exemple] ${example.subject}`,
        html: await example.html(),
        template: example.id,
        example: true,
      })
      results.push({ id: example.id, label: example.label, ok: sent.ok, message: sent.message })
    } catch (error) {
      results.push({ id: example.id, label: example.label, ok: false, message: `Modèle illisible : ${error instanceof Error ? error.message : String(error)}` })
    }
  }
  await logAdminAction(db, guard.userId, 'email.examples', { type: 'email', id: 'examples' }, { sent: results.filter((r) => r.ok).length, total: results.length })
  return NextResponse.json({ success: true, to: email, results })
}
