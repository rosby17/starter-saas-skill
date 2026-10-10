import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Vote à un sondage : remplace les choix du membre (un seul choix, sauf sondage à choix multiples).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const parsed = z.object({ postId: z.string().uuid(), options: z.array(z.number().int().min(0).max(11)).max(12) }).safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false }, { status: 400 })
  const { postId } = parsed.data
  const { data: post } = await supabase.from('community_posts').select('kind, meta').eq('id', postId).maybeSingle()
  if (!post || post.kind !== 'poll') return NextResponse.json({ success: false }, { status: 404 })
  const meta = post.meta as { options?: string[]; multiple?: boolean }
  const options = [...new Set(parsed.data.options)].filter((o) => o < (meta.options?.length ?? 0))
  if (!meta.multiple && options.length > 1) return NextResponse.json({ success: false, message: 'Un seul choix pour ce sondage.' }, { status: 400 })
  await supabase.from('community_poll_votes').delete().eq('post_id', postId).eq('user_id', user.id)
  if (options.length) {
    const { error } = await supabase.from('community_poll_votes').insert(options.map((option) => ({ post_id: postId, user_id: user.id, option })))
    if (error) return NextResponse.json({ success: false }, { status: 403 })
  }
  return NextResponse.json({ success: true })
}
