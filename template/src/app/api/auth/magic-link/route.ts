import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serviceClient } from '@/lib/auth/service-client'
import { createLoginLink, safeNext } from '@/lib/auth/access-link'
import { findUserIdByEmail } from '@/lib/customers'
import { sendEmail } from '@/lib/email/brevo'
import { loginLinkTemplate } from '@/lib/email/templates'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200), next: z.string().max(300).optional() })

/**
 * « Recevoir un lien de connexion » : envoie un lien de connexion directe à l'adresse, SI un compte existe.
 * Réponse identique dans tous les cas : on ne révèle pas quelles adresses ont un compte.
 */
export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!checkRateLimit(`magic:${ip}`, 5, 10 * 60_000).success) {
    return NextResponse.json({ success: false, message: 'Trop de demandes. Réessaie dans quelques minutes.' }, { status: 429 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Adresse e-mail invalide.' }, { status: 400 })
  const { email } = parsed.data
  const answer = NextResponse.json({ success: true, message: 'Si un compte existe pour cette adresse, un lien de connexion vient de lui être envoyé. Regarde aussi dans les spams.' })
  if (!checkRateLimit(`magic:${email}`, 3, 10 * 60_000).success) return answer

  try {
    const db = serviceClient()
    if (!(await findUserIdByEmail(db, email))) return answer
    const loginUrl = await createLoginLink(db, email, safeNext(parsed.data.next))
    if (loginUrl) {
      await sendEmail({ to: { email }, subject: '🔑 Ton lien de connexion', html: loginLinkTemplate({ loginUrl }), priority: 'critical' })
    }
  } catch (error) {
    console.error('Lien de connexion non envoyé :', error)
  }
  return answer
}
