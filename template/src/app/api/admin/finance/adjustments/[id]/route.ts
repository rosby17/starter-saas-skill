import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'

export const dynamic = 'force-dynamic'

// DELETE /api/admin/finance/adjustments/:id : retire une saisie erronée du pilotage. Les crédits éventuellement versés
// ne sont PAS repris ici (le registre des crédits est en ajout seul) : faire un mouvement « Autre retrait » pour cela.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, message: 'Identifiant invalide.' }, { status: 400 })
  const db = serviceClient()
  const { data, error } = await db.from('money_adjustments').delete().eq('id', id).select('*')
  if (error) return NextResponse.json({ success: false, message: 'Suppression impossible.' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ success: false, message: 'Mouvement introuvable.' }, { status: 404 })
  await logAdminAction(db, auth.userId, 'finance.adjustment.delete', { type: 'money_adjustments', id }, { before: data[0] })
  return NextResponse.json({ success: true })
}
