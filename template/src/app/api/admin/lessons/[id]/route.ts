import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'
import { lessonSchema, storagePathFor } from '@/lib/admin/schemas'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const parsed = lessonSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message }, { status: 400 })
  if (parsed.data.video_path && !storagePathFor(parsed.data.product_id, parsed.data.video_path)) {
    return NextResponse.json({ success: false, message: 'Chemin de vidéo invalide.' }, { status: 400 })
  }
  const db = serviceClient()
  const { data: before } = await db.from('lessons').select('video_path').eq('id', id).maybeSingle()
  const { error } = await db.from('lessons').update(parsed.data).eq('id', id)
  if (error) return NextResponse.json({ success: false, message: 'Enregistrement impossible.' }, { status: 400 })
  // Vidéo remplacée : l'ancien fichier est supprimé du stockage.
  if (before?.video_path && before.video_path !== parsed.data.video_path) await db.storage.from('videos').remove([before.video_path])
  await logAdminAction(db, auth.userId, 'lesson.update', { type: 'lesson', id })
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const db = serviceClient()
  const { data: lesson } = await db.from('lessons').select('video_path').eq('id', id).maybeSingle()
  const { error } = await db.from('lessons').delete().eq('id', id)
  if (error) return NextResponse.json({ success: false, message: 'Suppression impossible.' }, { status: 400 })
  if (lesson?.video_path) await db.storage.from('videos').remove([lesson.video_path])
  await logAdminAction(db, auth.userId, 'lesson.delete', { type: 'lesson', id })
  return NextResponse.json({ success: true })
}
