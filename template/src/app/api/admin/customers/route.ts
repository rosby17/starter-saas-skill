import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'

export const dynamic = 'force-dynamic'

// Liste des clients : GET /api/admin/customers?q=texte&page=1 (recherche sur le nom, l'e-mail, le téléphone).
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { searchParams } = new URL(request.url)
  // Liste blanche de caractères : la recherche est insérée dans un filtre .or() (aucune virgule, parenthèse ni joker).
  const q = (searchParams.get('q') || '').trim().replace(/[^\p{L}\p{N}@.+\-' ]/gu, '').slice(0, 80)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = 30
  const db = serviceClient()
  let query = db
    .from('profiles')
    .select('id, email, full_name, first_name, phone, country, is_admin, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (q) query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`)
  const { data, count, error } = await query
  if (error) return NextResponse.json({ success: false, message: 'Lecture des clients impossible.' }, { status: 500 })
  // Nombre d'accès actifs de chaque client de la page.
  const ids = (data ?? []).map((c) => c.id)
  // Accès actifs, formule Pro (super abonnement en cours) et moyen de paiement de la dernière commande payée.
  const [{ data: ents }, { data: paid }, { data: waiting }] = ids.length ? await Promise.all([
    db.from('entitlements').select('user_id, expires_at, products(covers_all)').in('user_id', ids).is('revoked_at', null),
    db.from('orders').select('user_id, payment_method, created_at').in('user_id', ids).eq('status', 'success').order('created_at', { ascending: false }),
    db.from('orders').select('user_id').in('user_id', ids).eq('status', 'pending'),
  ]) : [{ data: [] }, { data: [] }, { data: [] }]
  const counts = new Map<string, number>()
  const pro = new Set<string>()
  const student = new Set<string>() // a un accès à vie (formation payée ou offerte)
  const now = Date.now()
  for (const e of (ents ?? []) as { user_id: string; expires_at: string | null; products: { covers_all: boolean } | { covers_all: boolean }[] | null }[]) {
    counts.set(e.user_id, (counts.get(e.user_id) ?? 0) + 1)
    const p = Array.isArray(e.products) ? e.products[0] : e.products
    if (p?.covers_all && e.expires_at && new Date(e.expires_at).getTime() > now) pro.add(e.user_id)
    if (!e.expires_at) student.add(e.user_id)
  }
  const method = new Map<string, string>()
  for (const o of paid ?? []) if (o.payment_method && !method.has(o.user_id)) method.set(o.user_id, o.payment_method)
  const pending = new Set((waiting ?? []).map((o) => o.user_id as string))
  // Statut simple (10/10) : Membre Pro > Élève (a payé une formation) > Inscrit (rien payé, éventuellement une commande en attente).
  const status = (id: string) => (pro.has(id) ? 'pro' : student.has(id) || method.has(id) ? 'eleve' : 'inscrit')
  return NextResponse.json({ success: true, total: count ?? 0, pageSize, customers: (data ?? []).map((c) => ({ ...c, purchases: counts.get(c.id) ?? 0, pro: pro.has(c.id), status: status(c.id), pending: pending.has(c.id), payment_method: method.get(c.id) ?? null })) })
}
