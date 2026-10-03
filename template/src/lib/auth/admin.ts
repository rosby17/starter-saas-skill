import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Garde commune des routes /api/admin/* : session valide ET profiles.is_admin = true.
export async function requireAdmin(): Promise<
  { authorized: true; userId: string } | { authorized: false; error: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { authorized: false, error: NextResponse.json({ success: false, message: 'Non connecté.' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) return { authorized: false, error: NextResponse.json({ success: false, message: 'Accès réservé aux administrateurs.' }, { status: 403 }) }
  return { authorized: true, userId: user.id }
}
