import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'

export const dynamic = 'force-dynamic'

// Ajustement manuel de crédits : POST { amount: entier non nul (négatif = retrait), reason: texte obligatoire }.
// Écrit une ligne dans le registre (source 'admin_adjustment') et dans le journal d'audit.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const amount = Number(body.amount)
  const reason = String(body.reason || '').trim().slice(0, 300)
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000_000) {
    return NextResponse.json({ success: false, message: 'Montant invalide (entier non nul).' }, { status: 400 })
  }
  if (!reason) return NextResponse.json({ success: false, message: 'Une raison est obligatoire.' }, { status: 400 })

  const db = serviceClient()
  const { data: user } = await db.auth.admin.getUserById(id)
  if (!user?.user) return NextResponse.json({ success: false, message: 'Utilisateur introuvable.' }, { status: 404 })

  const { error } = await db.from('credits').insert({ user_id: id, amount, source: 'admin_adjustment' })
  if (error) return NextResponse.json({ success: false, message: "Ajustement impossible." }, { status: 500 })
  await logAdminAction(db, auth.userId, 'credits.adjust', { type: 'user', id }, { amount, reason })
  return NextResponse.json({ success: true })
}
