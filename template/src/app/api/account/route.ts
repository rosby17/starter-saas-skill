import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Droits du client sur SES données (RGPD et lois équivalentes) :
//   GET    → télécharger toutes ses données (JSON) ;
//   DELETE → supprimer son compte. Les commandes restent pour la comptabilité, détachées du compte (migration 0010).

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, message: 'Non connecté.' }, { status: 401 })
  if (!checkRateLimit(`export:${user.id}`, 5, 60_000).success) return NextResponse.json({ success: false, message: 'Trop de demandes.' }, { status: 429 })

  // Toujours filtré par user_id : un administrateur lit (RLS) les lignes de tout le monde.
  const [profile, orders, credits, tickets, feedbacks] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('orders').select('id, plan_name, credits, amount_local, currency, payment_method, status, created_at').eq('user_id', user.id).order('created_at'),
    supabase.from('credits').select('amount, source, created_at').eq('user_id', user.id).order('created_at'),
    supabase.from('support_tickets').select('subject, message, status, created_at').eq('user_id', user.id).order('created_at'),
    supabase.from('feedbacks').select('message, created_at').eq('user_id', user.id).order('created_at'),
  ])
  const body = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, createdAt: user.created_at },
    profile: profile.data,
    orders: orders.data ?? [],
    credits: credits.data ?? [],
    supportTickets: tickets.data ?? [],
    feedbacks: feedbacks.data ?? [],
  }
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}

const DeleteBody = z.object({ confirm: z.literal('SUPPRIMER') })

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, message: 'Non connecté.' }, { status: 401 })
  if (!checkRateLimit(`delete-account:${user.id}`, 3, 60_000).success) return NextResponse.json({ success: false, message: 'Trop de demandes.' }, { status: 429 })
  if (!DeleteBody.safeParse(await request.json().catch(() => null)).success) {
    return NextResponse.json({ success: false, message: 'Confirmation manquante.' }, { status: 400 })
  }
  const db = serviceClient()
  const { data: profile } = await db.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (profile?.is_admin) {
    // Garde-fou : un SaaS sans administrateur ne se gère plus. Retirer d'abord le rôle (Supabase), puis supprimer.
    return NextResponse.json({ success: false, message: 'Un compte administrateur ne se supprime pas d’ici.' }, { status: 403 })
  }
  const { error } = await db.auth.admin.deleteUser(user.id)
  if (error) {
    console.error('Suppression de compte impossible :', user.id, error)
    return NextResponse.json({ success: false, message: 'La suppression a échoué. Réessaie ou écris au support.' }, { status: 500 })
  }
  await supabase.auth.signOut()
  return NextResponse.json({ success: true })
}
