import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'

// Plan d'une formation (modules = « section » des leçons) :
//  - reorder       : { ids } ordre complet des leçons (positions 10, 20, 30…) ; sert aussi à déplacer un module entier ;
//  - rename_module : { from, to } renomme le module de toutes ses leçons ;
//  - delete_module : { name } supprime le module, ses leçons et leurs vidéos du stockage.
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reorder'), ids: z.array(z.string().uuid()).min(1).max(500) }),
  z.object({ action: z.literal('rename_module'), from: z.string().max(120), to: z.string().trim().min(1).max(120) }),
  z.object({ action: z.literal('delete_module'), name: z.string().max(120) }),
])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? 'Demande invalide.' }, { status: 400 })
  const db = serviceClient()
  const op = parsed.data
  // « » (chaîne vide) = leçons sans module.
  const lessonsOf = (name: string) => (name ? `section.eq.${JSON.stringify(name)}` : 'section.is.null')

  if (op.action === 'reorder') {
    const { data: own } = await db.from('lessons').select('id').eq('product_id', id)
    const mine = new Set((own ?? []).map((l) => l.id))
    if (op.ids.some((x) => !mine.has(x))) return NextResponse.json({ success: false, message: 'Leçon d’un autre produit.' }, { status: 400 })
    const results = await Promise.all(op.ids.map((lid, i) => db.from('lessons').update({ position: (i + 1) * 10 }).eq('id', lid).eq('product_id', id)))
    if (results.some((r) => r.error)) return NextResponse.json({ success: false, message: 'Ordre non enregistré.' }, { status: 500 })
  } else if (op.action === 'rename_module') {
    const { error } = await db.from('lessons').update({ section: op.to }).eq('product_id', id).or(lessonsOf(op.from))
    if (error) return NextResponse.json({ success: false, message: 'Module non renommé.' }, { status: 500 })
  } else {
    const { data: ls } = await db.from('lessons').select('id, video_path').eq('product_id', id).or(lessonsOf(op.name))
    const { error } = await db.from('lessons').delete().eq('product_id', id).or(lessonsOf(op.name))
    if (error) return NextResponse.json({ success: false, message: 'Module non supprimé.' }, { status: 500 })
    const videos = (ls ?? []).map((l) => l.video_path).filter(Boolean) as string[]
    if (videos.length) await db.storage.from('videos').remove(videos)
  }
  await logAdminAction(db, auth.userId, `course.${op.action}`, { type: 'product', id }, op as Record<string, unknown>)
  return NextResponse.json({ success: true })
}
