import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { contactSchema, findOrCreateCustomer } from '@/lib/customers'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { REQUEST_FORMS } from '@/lib/requests'
import { REQUEST_KINDS, type RequestKind } from '@/lib/catalog/types'
import { createLoginLink, loginPageUrl } from '@/lib/auth/access-link'
import { sendEmail } from '@/lib/email/brevo'
import { requestReceivedTemplate } from '@/lib/email/templates'
import { notifyAdmin } from '@/lib/orders/deliver'

const KINDS = Object.keys(REQUEST_KINDS) as [RequestKind, ...RequestKind[]]

const schema = z.object({
  kind: z.enum(KINDS),
  productSlug: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
  answers: z.record(z.string().max(40), z.string().trim().max(3000)).default({}),
  contact: contactSchema.optional(),
})

/**
 * Nouvelle demande (formulaire de départ d'un accompagnement, devis, monétisation bloquée).
 * Client connecté : la demande va sur SON compte. Visiteur : coordonnées obligatoires, son compte est créé
 * (ou retrouvé) et il reçoit un lien pour suivre sa demande. Le texte est stocké tel quel et toujours affiché échappé.
 */
export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!checkRateLimit(`request:${ip}`, 6, 10 * 60_000).success) {
    return NextResponse.json({ success: false, message: 'Trop de demandes envoyées. Réessaie dans quelques minutes.' }, { status: 429 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || 'Formulaire incomplet.' }, { status: 400 })
  const input = parsed.data
  const db = serviceClient()

  // Produit concerné : son type de demande prime ; un produit payant exige d'en avoir l'accès (formulaire de départ).
  let productId: string | null = null
  let kind = input.kind
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (input.productSlug) {
    const { data: product } = await db.from('products').select('id, request_kind, price_fcfa, title').eq('slug', input.productSlug).eq('published', true).maybeSingle()
    if (!product?.request_kind) return NextResponse.json({ success: false, message: 'Ce produit ne prend pas de demande.' }, { status: 400 })
    productId = product.id
    kind = product.request_kind as RequestKind
    if (product.price_fcfa != null && product.price_fcfa > 0) {
      const { data: access } = user
        ? await db.from('entitlements').select('id').eq('user_id', user.id).eq('product_id', product.id).is('revoked_at', null).maybeSingle()
        : { data: null }
      if (!access) return NextResponse.json({ success: false, message: 'Ce formulaire est réservé aux clients de cette offre.' }, { status: 403 })
    }
  }

  // Réponses : seulement les questions connues, obligatoires remplies.
  const form = REQUEST_FORMS[kind]
  const answers: Record<string, string> = {}
  for (const q of form.questions) {
    const value = (input.answers[q.id] || '').trim()
    if (q.required && !value) return NextResponse.json({ success: false, message: `Réponds à : « ${q.label} ».` }, { status: 400 })
    if (q.options && value && !q.options.includes(value)) return NextResponse.json({ success: false, message: `Choix invalide pour « ${q.label} ».` }, { status: 400 })
    if (value) answers[q.id] = value
  }
  const details = form.questions.filter((q) => answers[q.id]).map((q) => `${q.label} : ${answers[q.id]}`).join('\n')

  let userId: string
  let email: string
  if (user?.email) {
    userId = user.id
    email = user.email
  } else {
    if (!input.contact) return NextResponse.json({ success: false, message: 'Indique ton nom, ton e-mail et ton WhatsApp.' }, { status: 400 })
    if (!checkRateLimit(`request:${input.contact.email}`, 3, 10 * 60_000).success) {
      return NextResponse.json({ success: false, message: 'Trop de demandes pour cette adresse. Réessaie plus tard.' }, { status: 429 })
    }
    userId = (await findOrCreateCustomer(db, input.contact)).userId
    email = input.contact.email
  }

  const { data: created, error } = await db.from('service_requests').insert({ user_id: userId, product_id: productId, kind, details, answers }).select('id').single()
  if (error || !created) {
    console.error('Demande non enregistrée :', error)
    return NextResponse.json({ success: false, message: 'Le service est momentanément indisponible. Réessaie dans un instant.' }, { status: 500 })
  }

  const { data: profile } = await db.from('profiles').select('first_name, full_name, phone').eq('id', userId).maybeSingle()
  const next = `/demandes/${created.id}`
  if (!user) {
    const loginUrl = (await createLoginLink(db, email, next)) ?? loginPageUrl(next)
    await sendEmail({ to: { email }, subject: '📩 Ta demande est bien reçue', html: requestReceivedTemplate({ name: profile?.first_name, kind: REQUEST_KINDS[kind], loginUrl }), priority: 'high' })
  }
  await notifyAdmin(`📩 Nouvelle demande : ${REQUEST_KINDS[kind]}`, [
    `Client : ${profile?.full_name ?? '—'} · ${email} · ${profile?.phone ?? '—'}`,
    details.slice(0, 600),
  ], `/admin/requests/${created.id}`)

  return NextResponse.json({ success: true, id: created.id, signedIn: !!user })
}
