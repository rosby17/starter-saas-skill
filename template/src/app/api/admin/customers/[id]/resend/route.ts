import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { sendAccessEmail } from '@/lib/orders/deliver'

/** Renvoie au client son e-mail d'accès (lien de connexion directe + liste de ses achats). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const db = serviceClient()
  const { data } = await db.from('entitlements').select('product:products(title)').eq('user_id', id).is('revoked_at', null)
  const titles = (data ?? []).map((r) => (r.product as unknown as { title: string } | null)?.title).filter(Boolean) as string[]
  const emailed = await sendAccessEmail(db, id, titles.length ? titles : ['Ton espace client'])
  await logAdminAction(db, auth.userId, 'access.resend', { type: 'user', id }, { emailed })
  return NextResponse.json({ success: emailed, message: emailed ? 'E-mail envoyé.' : "E-mail non envoyé : vérifie la clé Brevo dans Clés et intégrations." })
}
