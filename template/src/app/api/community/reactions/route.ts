import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// Réaction d'un membre : un emoji par message (le même emoji une 2e fois = retirer). La base vérifie l'abonnement.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const parsed = z.object({ postId: z.string().uuid(), emoji: z.string().min(1).max(16).nullable() }).safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false }, { status: 400 })
  const { postId, emoji } = parsed.data
  const { error } = emoji
    ? await supabase.from('community_reactions').upsert({ post_id: postId, user_id: user.id, emoji }, { onConflict: 'post_id,user_id' })
    : await supabase.from('community_reactions').delete().eq('post_id', postId).eq('user_id', user.id)
  if (error) return NextResponse.json({ success: false }, { status: 403 })
  return NextResponse.json({ success: true })
}
