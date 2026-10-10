import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { announceToCourse } from '@/lib/notifications/announce'

const schema = z.object({
  title: z.string().trim().min(3, 'Donne un titre à la nouveauté.').max(160),
  body: z.string().trim().max(1000).optional(),
  email: z.boolean().default(true),
})

/** Annonce une nouveauté de la formation à ses élèves : notification dans l'espace + e-mail. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message }, { status: 400 })
  const db = serviceClient()
  const { data: product } = await db.from('products').select('slug').eq('id', id).maybeSingle()
  if (!product) return NextResponse.json({ success: false, message: 'Produit introuvable.' }, { status: 404 })
  try {
    const r = await announceToCourse(db, id, { ...parsed.data, url: `/cours/${product.slug}` })
    await logAdminAction(db, auth.userId, 'course.announce', { type: 'product', id }, { title: parsed.data.title, ...r })
    return NextResponse.json({ success: true, ...r, message: r.notified ? `Nouveauté annoncée à ${r.notified} élève${r.notified > 1 ? 's' : ''}${parsed.data.email ? ` (${r.emailed} e-mail${r.emailed > 1 ? 's' : ''} envoyé${r.emailed > 1 ? 's' : ''})` : ''}.` : 'Aucun élève n’a encore accès à cette formation.' })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ success: false, message: 'Annonce impossible pour le moment.' }, { status: 500 })
  }
}
