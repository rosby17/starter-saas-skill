import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serviceClient } from '@/lib/auth/service-client'
import { contactSchema, findOrCreateCustomer } from '@/lib/customers'
import { createLoginLink } from '@/lib/auth/access-link'
import { sendEmail } from '@/lib/email/brevo'
import { loginLinkTemplate } from '@/lib/email/templates'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'

/**
 * Mot de passe FACULTATIF : s'il est choisi (8 caractères min.) et que le compte est NOUVEAU, il est posé tout de suite
 * et le navigateur se connecte directement, sans attendre l'e-mail. Jamais sur un compte existant (pas de prise de
 * contrôle d'un compte par son e-mail) : dans ce cas, seul le lien par e-mail part.
 *
 * Création de compte SANS mot de passe : nom, e-mail, WhatsApp. Le compte n'est utilisable qu'en ouvrant
 * le lien envoyé à l'adresse (preuve que l'e-mail appartient bien à la personne). Même réponse si le compte
 * existe déjà : le lien de connexion part dans les deux cas.
 */
export async function POST(request: Request) {
  if (!checkRateLimit(`signup:${clientIp(request)}`, 5, 10 * 60_000).success) {
    return NextResponse.json({ success: false, message: 'Trop de tentatives. Réessaie dans quelques minutes.' }, { status: 429 })
  }
  const raw = await request.json().catch(() => ({}))
  const password = z.string().min(8).max(72).safeParse(raw?.password)
  if (raw?.password && !password.success) return NextResponse.json({ success: false, message: 'Mot de passe : 8 caractères minimum.' }, { status: 400 })
  const parsed = contactSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || 'Formulaire incomplet.' }, { status: 400 })
  if (!checkRateLimit(`signup:${parsed.data.email}`, 3, 10 * 60_000).success) {
    return NextResponse.json({ success: true, message: 'Un lien de connexion vient de t’être envoyé par e-mail.' })
  }
  try {
    const db = serviceClient()
    const customer = await findOrCreateCustomer(db, parsed.data)
    if (customer.created && password.success) {
      const { error } = await db.auth.admin.updateUserById(customer.userId, { password: password.data, email_confirm: true })
      if (!error) return NextResponse.json({ success: true, autoLogin: true, message: 'Bienvenue ! Ton espace est prêt.' })
      console.error('Inscription : mot de passe non posé :', error.message)
    }
    const loginUrl = await createLoginLink(db, parsed.data.email, '/dashboard')
    if (loginUrl) await sendEmail({ to: { email: parsed.data.email, name: parsed.data.fullName }, subject: '👋 Bienvenue : ton lien de connexion', html: loginLinkTemplate({ loginUrl }), priority: 'critical' })
  } catch (error) {
    console.error('Inscription :', error)
    return NextResponse.json({ success: false, message: 'Le service est momentanément indisponible. Réessaie dans un instant.' }, { status: 500 })
  }
  return NextResponse.json({ success: true, message: 'Compte prêt : ouvre le lien qu’on vient de t’envoyer par e-mail pour entrer dans ton espace (regarde aussi dans les spams).' })
}
