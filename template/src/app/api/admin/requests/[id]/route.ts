import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { sendEmail } from '@/lib/email/brevo'
import { requestUpdateTemplate } from '@/lib/email/templates'
import { REQUEST_KINDS, type RequestKind } from '@/lib/catalog/types'
import { REQUEST_STATUS } from '@/lib/requests'
import { createLoginLink, loginPageUrl } from '@/lib/auth/access-link'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const db = serviceClient()
  const { data: r } = await db.from('service_requests').select('id, kind, status, details, answers, admin_reply, created_at, updated_at, user_id, product_id').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ success: false, message: 'Demande introuvable.' }, { status: 404 })
  const [{ data: profile }, { data: product }] = await Promise.all([
    db.from('profiles').select('id, full_name, email, phone, country').eq('id', r.user_id).maybeSingle(),
    r.product_id ? db.from('products').select('title').eq('id', r.product_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  return NextResponse.json({ success: true, request: r, profile, product })
}

const schema = z.object({
  status: z.enum(['nouvelle', 'en_cours', 'terminee', 'annulee']),
  admin_reply: z.string().trim().max(6000).optional().nullable().transform((v) => (v ? v : null)),
  notify: z.boolean().default(true),
})

/** Met à jour le statut et la réponse ; prévient le client par e-mail (lien direct vers sa demande). */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!/^[0-9a-f-]{36}$/i.test(id) || !parsed.success) return NextResponse.json({ success: false, message: 'Requête invalide.' }, { status: 400 })
  const db = serviceClient()
  const { data: r, error } = await db.from('service_requests').update({ status: parsed.data.status, admin_reply: parsed.data.admin_reply }).eq('id', id).select('user_id, kind').single()
  if (error || !r) return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 400 })

  let emailed = false
  if (parsed.data.notify) {
    const { data: u } = await db.auth.admin.getUserById(r.user_id)
    const { data: profile } = await db.from('profiles').select('first_name').eq('id', r.user_id).maybeSingle()
    const email = u?.user?.email
    if (email) {
      const url = (await createLoginLink(db, email, `/demandes/${id}`)) ?? loginPageUrl(`/demandes/${id}`)
      emailed = await sendEmail({
        to: { email },
        subject: '💬 Ta demande a été mise à jour',
        html: requestUpdateTemplate({ name: profile?.first_name, kind: REQUEST_KINDS[r.kind as RequestKind] ?? r.kind, status: REQUEST_STATUS[parsed.data.status].label, reply: parsed.data.admin_reply, url }),
        priority: 'high',
      })
    }
  }
  await logAdminAction(db, auth.userId, 'request.update', { type: 'service_request', id }, { status: parsed.data.status, emailed })
  return NextResponse.json({ success: true, emailed })
}
