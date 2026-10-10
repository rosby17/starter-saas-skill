import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({ lessonId: z.string().uuid(), done: z.boolean() })

/** Coche / décoche une leçon. Session du client : la RLS refuse une leçon d'un produit qu'il n'a pas acheté. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false }, { status: 400 })
  const { lessonId, done } = parsed.data
  const { error } = done
    ? await supabase.from('lesson_progress').upsert({ user_id: user.id, lesson_id: lessonId }, { onConflict: 'user_id,lesson_id', ignoreDuplicates: true })
    : await supabase.from('lesson_progress').delete().eq('user_id', user.id).eq('lesson_id', lessonId)
  if (error) return NextResponse.json({ success: false }, { status: 403 })
  return NextResponse.json({ success: true })
}
