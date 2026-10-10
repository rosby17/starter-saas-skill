import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { lessonSchema, storagePathFor } from '@/lib/admin/schemas'

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const parsed = lessonSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message }, { status: 400 })
  if (parsed.data.video_path && !storagePathFor(parsed.data.product_id, parsed.data.video_path)) {
    return NextResponse.json({ success: false, message: 'Chemin de vidéo invalide.' }, { status: 400 })
  }
  const db = serviceClient()
  const { data, error } = await db.from('lessons').insert(parsed.data).select('id').single()
  if (error) return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 400 })
  await logAdminAction(db, auth.userId, 'lesson.create', { type: 'lesson', id: data.id }, { product_id: parsed.data.product_id })
  return NextResponse.json({ success: true, id: data.id })
}
