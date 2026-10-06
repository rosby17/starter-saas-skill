import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'

export const dynamic = 'force-dynamic'

// Donne ou retire l'accès à l'administration : PUT { isAdmin: boolean }. Journalisé.
// Un administrateur ne peut pas se retirer lui-même ses droits (on ne se ferme pas la porte).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  if (typeof body.isAdmin !== 'boolean') return NextResponse.json({ success: false, message: 'Réglage invalide.' }, { status: 400 })
  if (id === auth.userId && !body.isAdmin) {
    return NextResponse.json({ success: false, message: 'Tu ne peux pas retirer tes propres droits d’administrateur.' }, { status: 400 })
  }
  const db = serviceClient()
  const { data, error } = await db.from('profiles').update({ is_admin: body.isAdmin }).eq('id', id).select('id')
  if (error) return NextResponse.json({ success: false, message: 'Modification impossible.' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ success: false, message: 'Utilisateur introuvable.' }, { status: 404 })
  await logAdminAction(db, auth.userId, body.isAdmin ? 'user.admin_grant' : 'user.admin_revoke', { type: 'user', id })
  return NextResponse.json({ success: true })
}
