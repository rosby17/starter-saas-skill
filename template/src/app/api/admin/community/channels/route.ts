import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { logAdminAction } from '@/lib/auth/audit'

// Groupes de la communauté (admin) : créer { name, description, mode } ou supprimer { delete: slug }.
const create = z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(300).default(''), mode: z.enum(['annonces', 'discussion']).default('discussion') })

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const body = await request.json().catch(() => ({}))
  const db = serviceClient()
  if (typeof body?.delete === 'string') {
    if (['annonces', 'discussion'].includes(body.delete)) return NextResponse.json({ success: false, message: 'Les groupes Annonces et Discussion ne se suppriment pas.' }, { status: 400 })
    const { data: ch } = await db.from('community_channels').select('id').eq('slug', body.delete).maybeSingle()
    if (!ch) return NextResponse.json({ success: false, message: 'Groupe introuvable.' }, { status: 404 })
    const { data: posts } = await db.from('community_posts').select('media').eq('channel_id', ch.id)
    const paths = (posts ?? []).flatMap((p) => ((p.media as { path: string }[]) ?? []).map((m) => m.path))
    await db.from('community_channels').delete().eq('id', ch.id)
    if (paths.length) await db.storage.from('community').remove(paths)
    await logAdminAction(db, auth.userId, 'community.channel_delete', { type: 'community_channel', id: ch.id })
    return NextResponse.json({ success: true })
  }
  const parsed = create.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, message: 'Donne un nom au groupe.' }, { status: 400 })
  const base = parsed.data.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'groupe'
  let slug = base
  for (let i = 2; (await db.from('community_channels').select('id').eq('slug', slug).maybeSingle()).data; i++) slug = `${base}-${i}`
  const { data, error } = await db.from('community_channels').insert({ ...parsed.data, slug, position: 100 }).select('slug').single()
  if (error || !data) return NextResponse.json({ success: false, message: 'Groupe non créé.' }, { status: 500 })
  await logAdminAction(db, auth.userId, 'community.channel_create', { type: 'community_channel', id: data.slug })
  return NextResponse.json({ success: true, slug: data.slug })
}
