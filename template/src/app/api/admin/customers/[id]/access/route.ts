import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { productTitlesWithIncludes, sendAccessEmail } from '@/lib/orders/deliver'

const schema = z.object({ productId: z.string().uuid(), notify: z.boolean().default(true) })
const grantSchema = z.object({ productIds: z.array(z.string().uuid()).min(1).max(30), notify: z.boolean().default(true) })
type Ctx = { params: Promise<{ id: string }> }

/** Donner l'accès à un ou plusieurs produits (paiement reçu à la main, cadeau…) : accès + inclus, UN e-mail au client. */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  const parsed = grantSchema.safeParse(await request.json().catch(() => ({})))
  if (!/^[0-9a-f-]{36}$/i.test(id) || !parsed.success) return NextResponse.json({ success: false, message: 'Requête invalide.' }, { status: 400 })
  const db = serviceClient()
  const titles: string[] = []
  for (const productId of parsed.data.productIds) {
    const { error } = await db.rpc('grant_product_access', { p_user_id: id, p_product_id: productId, p_source: 'admin', p_order_id: null, p_granted_by: auth.userId })
    if (error) return NextResponse.json({ success: false, message: `Accès non accordé (${titles.length} déjà donné${titles.length > 1 ? 's' : ''}).` }, { status: 400 })
    titles.push(...(await productTitlesWithIncludes(db, productId)))
  }
  let emailed = false
  if (parsed.data.notify) emailed = await sendAccessEmail(db, id, [...new Set(titles)])
  await logAdminAction(db, auth.userId, 'access.grant', { type: 'user', id }, { product_ids: parsed.data.productIds, emailed })
  const n = parsed.data.productIds.length
  return NextResponse.json({ success: true, emailed, message: `${n > 1 ? `${n} accès donnés` : 'Accès donné'}${emailed ? ', e-mail envoyé.' : '.'}` })
}

/** Retirer l'accès (partage constaté, remboursement). Réversible : redonner l'accès le rétablit. */
export async function DELETE(request: Request, { params }: Ctx) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  const parsed = schema.pick({ productId: true }).safeParse(await request.json().catch(() => ({})))
  if (!/^[0-9a-f-]{36}$/i.test(id) || !parsed.success) return NextResponse.json({ success: false, message: 'Requête invalide.' }, { status: 400 })
  const db = serviceClient()
  const { error } = await db.from('entitlements').update({ revoked_at: new Date().toISOString() }).eq('user_id', id).eq('product_id', parsed.data.productId).is('revoked_at', null)
  if (error) return NextResponse.json({ success: false, message: 'Retrait impossible.' }, { status: 400 })
  await logAdminAction(db, auth.userId, 'access.revoke', { type: 'user', id }, { product_id: parsed.data.productId })
  return NextResponse.json({ success: true, message: 'Accès retiré.' })
}
