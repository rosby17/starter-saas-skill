import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { productSchema } from '@/lib/admin/schemas'
import { CATALOG_TAG } from '@/lib/catalog/server'
import { PRODUCT_COLUMNS } from '@/lib/catalog/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const db = serviceClient()
  const [{ data }, { data: lessons }, { data: files }, { data: access }] = await Promise.all([
    db.from('products').select(PRODUCT_COLUMNS).order('category').order('position'),
    db.from('lessons').select('product_id, video_path, youtube_url'),
    db.from('product_files').select('product_id'),
    db.from('entitlements').select('product_id').is('revoked_at', null),
  ])
  // État du contenu de chaque produit, pour repérer d'un coup d'œil les cours vides.
  const stats: Record<string, { lessons: number; videos: number; files: number; buyers: number }> = {}
  const of = (id: string) => (stats[id] ??= { lessons: 0, videos: 0, files: 0, buyers: 0 })
  for (const l of lessons ?? []) { of(l.product_id).lessons++; if (l.video_path || l.youtube_url) of(l.product_id).videos++ }
  for (const f of files ?? []) of(f.product_id).files++
  for (const e of access ?? []) of(e.product_id).buyers++
  return NextResponse.json({ success: true, products: data ?? [], stats })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const parsed = productSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message }, { status: 400 })
  const db = serviceClient()
  const { data, error } = await db.from('products').insert(parsed.data).select('id').single()
  if (error) return NextResponse.json({ success: false, message: error.code === '23505' ? 'Cet identifiant existe déjà.' : 'Enregistrement impossible.' }, { status: 400 })
  await logAdminAction(db, auth.userId, 'product.create', { type: 'product', id: data.id }, { slug: parsed.data.slug })
  revalidateTag(CATALOG_TAG)
  return NextResponse.json({ success: true, id: data.id })
}
