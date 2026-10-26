import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { z } from 'zod'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { setSuspended } from '@/lib/admin/accounts'
import { findSuspensionReason } from '@/lib/admin/suspension-reasons'

export const dynamic = 'force-dynamic'

// Fiche client : coordonnées, accès, commandes, demandes.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const db = serviceClient()
  const [{ data: profile }, { data: entitlements }, { data: orders }, { data: requests }, { data: products }] = await Promise.all([
    db.from('profiles').select('id, email, full_name, first_name, phone, country, is_admin, is_internal, suspension_reason, suspended_at, created_at').eq('id', id).maybeSingle(),
    db.from('entitlements').select('id, product_id, source, created_at, revoked_at, order_id').eq('user_id', id).order('created_at', { ascending: false }),
    db.from('orders').select('id, plan_name, amount_local, currency, payment_method, status, created_at, customer_country, customer_phone').eq('user_id', id).order('created_at', { ascending: false }).limit(50),
    db.from('service_requests').select('id, kind, status, created_at').eq('user_id', id).order('created_at', { ascending: false }),
    db.from('products').select('id, slug, title, external_url').order('position'),
  ])
  if (!profile) return NextResponse.json({ success: false, message: 'Client introuvable.' }, { status: 404 })
  // Pays et WhatsApp absents du profil : on reprend ceux donnés à la dernière commande.
  const fromOrder = (orders ?? []).find((o) => o.customer_country || o.customer_phone)
  if (!profile.country && fromOrder?.customer_country) profile.country = fromOrder.customer_country
  if (!profile.phone && fromOrder?.customer_phone) profile.phone = fromOrder.customer_phone
  const { data: authUser } = await db.auth.admin.getUserById(id)
  const u = authUser?.user as { banned_until?: string | null; last_sign_in_at?: string | null } | undefined
  const account = {
    suspended: !!u?.banned_until && new Date(u.banned_until).getTime() > Date.now(),
    last_sign_in_at: u?.last_sign_in_at ?? null,
  }
  return NextResponse.json({ success: true, profile, account, self: id === auth.userId, entitlements: entitlements ?? [], orders: orders ?? [], requests: requests ?? [], products: products ?? [] })
}

const patchSchema = z.object({
  full_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).regex(/^[+\d\s().-]*$/, 'Numéro invalide.').optional(),
  country: z.string().trim().max(60).optional(),
  is_admin: z.boolean().optional(),
  is_internal: z.boolean().optional(),
  suspended: z.boolean().optional(),
  // Suspension : motif obligatoire (liste lib/admin/suspension-reasons.ts) ; notify = e-mail préétabli du motif.
  reason_code: z.string().max(60).optional(),
  notify: z.boolean().optional(),
})

// Modifier une fiche client : coordonnées, rôle administrateur, suspension du compte (connexion bloquée).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? 'Données invalides.' }, { status: 400 })
  const { suspended, reason_code, notify, ...fields } = parsed.data
  const reason = findSuspensionReason(reason_code)
  if (suspended === true && !reason) return NextResponse.json({ success: false, message: 'Choisis un motif de suspension.' }, { status: 400 })
  if (id === auth.userId && (fields.is_admin === false || suspended === true)) {
    return NextResponse.json({ success: false, message: 'Tu ne peux pas retirer tes propres droits ni suspendre ton compte.' }, { status: 400 })
  }
  const db = serviceClient()
  const update = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v === '' ? null : v]))
  if (Object.keys(update).length) {
    const { error } = await db.from('profiles').update(update).eq('id', id)
    if (error) return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 500 })
  }
  let emailed = false
  if (suspended !== undefined) {
    try {
      const { data: authUser } = await db.auth.admin.getUserById(id)
      emailed = (await setSuspended(db, auth.userId, { id, email: authUser?.user?.email ?? null }, suspended, { reason, notify })).emailed
    } catch (error) {
      console.error('Suspension :', error)
      return NextResponse.json({ success: false, message: suspended ? 'Suspension impossible.' : 'Réactivation impossible.' }, { status: 500 })
    }
  }
  if (Object.keys(update).length) await logAdminAction(db, auth.userId, 'customer.update', { type: 'user', id }, update)
  return NextResponse.json({
    success: true,
    message: suspended === true ? `Compte suspendu : le client ne peut plus se connecter${emailed ? ' (e-mail du motif envoyé)' : ''}.` : suspended === false ? 'Compte réactivé.' : 'Fiche enregistrée.',
  })
}
