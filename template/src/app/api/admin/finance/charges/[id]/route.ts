import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { chargeSchema } from '@/lib/finance/schemas'

export const dynamic = 'force-dynamic'

const TABLES = { charge: 'finance_charges', provider_rate: 'provider_rates', fee_rate: 'payment_fee_rates' } as const
type Kind = keyof typeof TABLES
const UUID = /^[0-9a-f-]{36}$/i

// PATCH /api/admin/finance/charges/:id { data } : modifier une charge fixe ou ponctuelle (les tarifs, eux, se versionnent).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ success: false, message: 'Identifiant invalide.' }, { status: 400 })
  const body = await request.json().catch(() => ({}))
  const parsed = chargeSchema.safeParse(body.data ?? {})
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || 'Champs invalides.' }, { status: 400 })
  const db = serviceClient()
  const { data, error } = await db.from('finance_charges').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', id).select('id')
  if (error) return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ success: false, message: 'Charge introuvable.' }, { status: 404 })
  await logAdminAction(db, auth.userId, 'finance.charge.update', { type: 'finance_charges', id }, parsed.data as Record<string, unknown>)
  return NextResponse.json({ success: true })
}

// DELETE /api/admin/finance/charges/:id?type=charge|provider_rate|fee_rate
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  const type = (new URL(request.url).searchParams.get('type') || 'charge') as Kind
  if (!UUID.test(id) || !(type in TABLES)) return NextResponse.json({ success: false, message: 'Requête invalide.' }, { status: 400 })
  const db = serviceClient()
  const { data, error } = await db.from(TABLES[type]).delete().eq('id', id).select('*')
  if (error) return NextResponse.json({ success: false, message: 'Suppression impossible.' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ success: false, message: 'Introuvable.' }, { status: 404 })
  // La ligne supprimée est gardée dans le journal d'audit.
  await logAdminAction(db, auth.userId, `finance.${type}.delete`, { type: TABLES[type], id }, { before: data[0] })
  return NextResponse.json({ success: true })
}
