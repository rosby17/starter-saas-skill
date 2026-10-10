import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'

export const dynamic = 'force-dynamic'

const STATUSES = ['pending', 'success', 'failed', 'expired', 'cancelled', 'flagged_underpaid', 'flagged_reversal']

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
    .select('id, user_id, plan_name, credits, amount_local, amount_fcfa, currency, payment_method, payment_ref, status, created_at, customer_name, customer_email, customer_phone, customer_country, paid_amount_fcfa, payment_note, paid_at, is_test, purchase_kind, client_ip, ip_country, price_zone, product:products(title, image)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  // « Toutes » : vraiment toutes (payées, en attente, annulées, tests). « test » : le bac à sable seul.
  // « cancelled » regroupe annulées, abandonnées et expirées : pour l'admin, c'est le même échec.
  if (status === 'test') query = query.eq('is_test', true)
  else if (status) {
    query = query.eq('is_test', false)
    if (status === 'cancelled') query = query.in('status', ['cancelled', 'failed', 'expired'])
    else if (STATUSES.includes(status)) query = query.eq('status', status)
  }
  // Recherche : identifiant de commande (UUID complet), référence de paiement, e-mail, nom ou téléphone du client.
  // Liste blanche de caractères : la recherche est insérée dans un filtre .or() (aucune virgule, parenthèse ni joker).
  const term = q.replace(/[^\p{L}\p{N}@.+\-' ]/gu, '')
  if (q) query = /^[0-9a-f-]{36}$/i.test(q) ? query.eq('id', q) : query.or(`payment_ref.ilike.%${term}%,customer_email.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ success: false, message: 'Lecture des commandes impossible.' }, { status: 500 })

  // Adresses e-mail des acheteurs (commandes anciennes sans coordonnées enregistrées).
  const ids = [...new Set((data || []).filter((o) => !o.customer_email).map((o) => o.user_id))]
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
    orders: (data || []).map((o) => ({ ...o, email: o.customer_email || emails[o.user_id] || null })),
  })
}
