import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'

export const dynamic = 'force-dynamic'

const STATUSES = ['pending', 'success', 'failed', 'expired', 'flagged_underpaid', 'flagged_reversal']

// Liste paginée des commandes : GET /api/admin/orders?status=pending&q=texte&page=1
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''
  const q = (searchParams.get('q') || '').trim().slice(0, 80)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = 25

  const db = serviceClient()
  let query = db
    .from('orders')
    .select('id, user_id, plan_name, credits, amount_local, amount_fcfa, currency, payment_method, payment_ref, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (STATUSES.includes(status)) query = query.eq('status', status)
  // Recherche : l'identifiant de commande (UUID complet) ou la référence de paiement.
  if (q) query = /^[0-9a-f-]{36}$/i.test(q) ? query.eq('id', q) : query.ilike('payment_ref', `%${q.replace(/[%_]/g, '')}%`)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ success: false, message: 'Lecture des commandes impossible.' }, { status: 500 })

  // Adresses e-mail des acheteurs (pour l'affichage).
  const ids = [...new Set((data || []).map((o) => o.user_id))]
  const emails: Record<string, string> = {}
  await Promise.all(ids.map(async (id) => {
    const { data: u } = await db.auth.admin.getUserById(id)
    if (u?.user?.email) emails[id] = u.user.email
  }))

  return NextResponse.json({
    success: true,
    total: count ?? 0,
    page,
    pageSize,
    orders: (data || []).map((o) => ({ ...o, email: emails[o.user_id] || null })),
  })
}
