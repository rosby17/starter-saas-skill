import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Les 20 dernières notifications de l'élève (RLS : uniquement les siennes). */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const { data } = await supabase.from('notifications').select('id, title, body, url, created_at, read_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
  return NextResponse.json({ success: true, notifications: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}

/** Tout marquer comme lu. */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
  return NextResponse.json({ success: true })
}
