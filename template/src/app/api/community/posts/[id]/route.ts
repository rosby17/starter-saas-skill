import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'

type Ctx = { params: Promise<{ id: string }> }

// Épingler / désépingler (admin). La base (RLS) refuse à un membre d'épingler.
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const parsed = z.object({ pinned: z.boolean() }).safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase.from('community_posts').update({ pinned: parsed.data.pinned }).eq('id', id).select('id')
  if (error || !data?.length) return NextResponse.json({ success: false, message: 'Action réservée à l’administrateur.' }, { status: 403 })
  return NextResponse.json({ success: true })
}

// Supprimer : l'auteur ou l'admin (RLS). Les médias partent aussi du stockage.
export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false }, { status: 400 })
  const supabase = await createClient()
  const { data: post } = await supabase.from('community_posts').select('media').eq('id', id).maybeSingle()
  const { data, error } = await supabase.from('community_posts').delete().eq('id', id).select('id')
  if (error || !data?.length) return NextResponse.json({ success: false, message: 'Suppression impossible.' }, { status: 403 })
  const paths = ((post?.media as { path: string }[]) ?? []).map((m) => m.path)
  if (paths.length) await serviceClient().storage.from('community').remove(paths)
  return NextResponse.json({ success: true })
}
