import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Droits du client sur SES données (RGPD et lois équivalentes) :
//   GET    → télécharger toutes ses données (fichier JSON) ;
//   DELETE → supprimer son compte. Les commandes restent pour la comptabilité, détachées du compte.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, message: 'Non connecté.' }, { status: 401 })
  if (!checkRateLimit(`export:${user.id}`, 5, 60_000).success) return NextResponse.json({ success: false, message: 'Trop de demandes.' }, { status: 429 })
  // Toujours filtré par user_id : un administrateur lit (RLS) les lignes de tout le monde.
  const [profile, orders, accesses, progress, onboarding, requests, calls, posts] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('orders').select('id, plan_name, amount_local, currency, payment_method, status, created_at').eq('user_id', user.id).order('created_at'),
    supabase.from('entitlements').select('created_at, expires_at, source, products(title)').eq('user_id', user.id),
    supabase.from('lesson_progress').select('lesson_id, completed_at').eq('user_id', user.id),
    supabase.from('course_onboarding').select('*').eq('user_id', user.id),
    supabase.from('service_requests').select('kind, details, status, created_at').eq('user_id', user.id),
    supabase.from('call_bookings').select('status, topic, scheduled_at, created_at').eq('user_id', user.id),
    supabase.from('community_posts').select('body, created_at').eq('author_id', user.id),
  ])
  const body = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, createdAt: user.created_at, providers: (user.identities ?? []).map((i) => i.provider) },
    profile: profile.data, orders: orders.data ?? [], accesses: accesses.data ?? [], lessonProgress: progress.data ?? [],
    courseQuestionnaires: onboarding.data ?? [], requests: requests.data ?? [], calls: calls.data ?? [], communityMessages: posts.data ?? [],
  }
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' },
  })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, message: 'Non connecté.' }, { status: 401 })
  if (!checkRateLimit(`delete-account:${user.id}`, 3, 60_000).success) return NextResponse.json({ success: false, message: 'Trop de demandes.' }, { status: 429 })
  if (!z.object({ confirm: z.literal('SUPPRIMER') }).safeParse(await request.json().catch(() => null)).success) {
    return NextResponse.json({ success: false, message: 'Écris SUPPRIMER pour confirmer.' }, { status: 400 })
  }
  const db = serviceClient()
  const { data: profile } = await db.from('profiles').select('is_admin, avatar_url').eq('id', user.id).maybeSingle()
  if (profile?.is_admin) return NextResponse.json({ success: false, message: 'Un compte administrateur ne se supprime pas d’ici.' }, { status: 403 })
  const avatar = profile?.avatar_url?.split('/avatars/')[1]
  if (avatar?.startsWith(`${user.id}/`)) await db.storage.from('avatars').remove([avatar])
  const { error } = await db.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('Suppression de compte impossible :', user.id, error)
    return NextResponse.json({ success: false, message: 'La suppression a échoué. Réessaie ou écris au support.' }, { status: 500 })
  }
  await supabase.auth.signOut()
  return NextResponse.json({ success: true })
}
