import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { getCreditsBalance } from '@/lib/credits/balance'

export const dynamic = 'force-dynamic'

// Crédits ajoutés (ou repris) par l'administrateur que le client n'a pas encore vus : montrés dans une fenêtre à sa
// prochaine visite, avec le motif écrit par l'admin (credits.note) et le nouveau solde. Le « vu » est une date dans
// user_metadata : pas de table en plus. 14 jours au plus : on ne ressort pas un cadeau de l'an dernier.
const SEEN_KEY = 'credit_notices_seen_at'
const MAX_AGE_DAYS = 14

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ notices: [] })
  const seen = typeof user.user_metadata?.[SEEN_KEY] === 'string' ? (user.user_metadata[SEEN_KEY] as string) : ''
  const floor = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000).toISOString()
  const since = seen > floor ? seen : floor
  // Lecture avec la session du client : la RLS de credits ne lui montre que ses lignes.
  const { data, error } = await supabase.from('credits').select('id, amount, note, created_at')
    .eq('user_id', user.id).eq('source', 'admin_adjustment').neq('amount', 0).gt('created_at', since)
    .order('created_at', { ascending: false }).limit(10)
  if (error || !data?.length) return NextResponse.json({ notices: [] })
  const balance = await getCreditsBalance(serviceClient(), user.id).catch(() => null)
  return NextResponse.json({ notices: data, balance })
}

/** Le client a fermé la fenêtre : ne plus lui montrer ces mouvements. */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const { error } = await serviceClient().auth.admin.updateUserById(user.id, { user_metadata: { ...(user.user_metadata || {}), [SEEN_KEY]: new Date().toISOString() } })
  return NextResponse.json({ success: !error })
}
