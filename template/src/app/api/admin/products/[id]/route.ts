import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { announceToReservations } from '@/lib/notifications/announce'
import { productSchema } from '@/lib/admin/schemas'
import { CATALOG_TAG } from '@/lib/catalog/server'
import { PRODUCT_COLUMNS } from '@/lib/catalog/types'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }
const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id)

export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!isId(id)) return NextResponse.json({ success: false }, { status: 400 })
  const db = serviceClient()
  const [{ data: product }, { data: lessons }, { data: files }, { data: privateInfo }, { count: buyers }] = await Promise.all([
    db.from('products').select(PRODUCT_COLUMNS).eq('id', id).maybeSingle(),
    db.from('lessons').select('id, title, section, summary, description, youtube_url, video_path, duration_seconds, is_preview, position, released_at').eq('product_id', id).order('position'),
    db.from('product_files').select('id, title, storage_path, size_bytes, position').eq('product_id', id).order('position'),
    db.from('product_private').select('group_url, welcome_message').eq('product_id', id).maybeSingle(),
    db.from('entitlements').select('id', { count: 'exact', head: true }).eq('product_id', id).is('revoked_at', null),
  ])
  if (!product) return NextResponse.json({ success: false, message: 'Produit introuvable.' }, { status: 404 })
  return NextResponse.json({ success: true, product, lessons: lessons ?? [], files: files ?? [], privateInfo: privateInfo ?? { group_url: null, welcome_message: null }, buyers: buyers ?? 0 })
}

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!isId(id)) return NextResponse.json({ success: false }, { status: 400 })
  const parsed = productSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message }, { status: 400 })
  const db = serviceClient()
  const { data: before } = await db.from('products').select('preorder, slug, title').eq('id', id).maybeSingle()
  const { error } = await db.from('products').update(parsed.data).eq('id', id)
  if (error) return NextResponse.json({ success: false, message: error.code === '23505' ? 'Cet identifiant existe déjà.' : 'Enregistrement impossible.' }, { status: 400 })
  await logAdminAction(db, auth.userId, 'product.update', { type: 'product', id }, { slug: parsed.data.slug, price: parsed.data.price_fcfa, promo: parsed.data.promo_price_fcfa, published: parsed.data.published })
  revalidateTag(CATALOG_TAG)
  // La formation sort de précommande : chaque élève qui a réservé est prévenu (cloche + e-mail) pour terminer son inscription.
  if (before?.preorder && !parsed.data.preorder) {
    try {
      await announceToReservations(db, id, { title: `${parsed.data.title} est disponible`, body: 'Ta place était réservée : termine ton inscription avec 60 % du prix (ta réservation est déduite).', url: `/dashboard/offres/${parsed.data.slug}` })
    } catch (e) {
      console.error('Prévenir les réservations :', e)
    }
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!isId(id)) return NextResponse.json({ success: false }, { status: 400 })
  const db = serviceClient()
  // Un produit déjà vendu ne se supprime pas (les clients perdraient leur accès) : on le dépublie.
  const { count } = await db.from('entitlements').select('id', { count: 'exact', head: true }).eq('product_id', id)
  if (count) return NextResponse.json({ success: false, message: 'Ce produit a des acheteurs : dépublie-le au lieu de le supprimer.' }, { status: 409 })
  const { error } = await db.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ success: false, message: 'Suppression impossible.' }, { status: 400 })
  await logAdminAction(db, auth.userId, 'product.delete', { type: 'product', id })
  revalidateTag(CATALOG_TAG)
  return NextResponse.json({ success: true })
}
