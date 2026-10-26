import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { ADMIN_CURRENCY_KEY, isCurrency } from '@/lib/finance/money'
import { getAdminCurrency, loadFcfaPer } from '@/lib/finance/server'

export const dynamic = 'force-dynamic'

// Devise d'affichage de toute l'administration (la même pour tous les admins) et taux du moment.
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const db = serviceClient()
  const [currency, fcfaPer] = await Promise.all([getAdminCurrency(db), loadFcfaPer(db)])
  return NextResponse.json({ success: true, currency, fcfaPer }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PUT(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const body = await request.json().catch(() => ({}))
  if (!isCurrency(body.currency)) return NextResponse.json({ success: false, message: 'Devise inconnue.' }, { status: 400 })
  const db = serviceClient()
  const { error } = await db.from('system_settings').upsert({ key: ADMIN_CURRENCY_KEY, value: { currency: body.currency }, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 500 })
  await logAdminAction(db, auth.userId, 'finance.currency', { type: 'setting', id: ADMIN_CURRENCY_KEY }, { currency: body.currency })
  return NextResponse.json({ success: true, currency: body.currency })
}
