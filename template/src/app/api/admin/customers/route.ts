import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { listAccounts, parseAccountFilter, type AccountRow } from '@/lib/admin/accounts'

export const dynamic = 'force-dynamic'

// Liste des clients : GET /api/admin/customers?q=texte&page=1&account=live&activity=all&spent=all&risk=all
// Recherche sur le nom, l'e-mail et le téléphone (par ses chiffres). Filtres et pagination faits DANS la base
// (admin_list_accounts) : une recherche large ne peut plus casser la liste (« URI too long »).
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  const { searchParams } = new URL(request.url)
  const filter = parseAccountFilter(searchParams)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const pageSize = 30
  const db = serviceClient()
  let data: AccountRow[]
  let count: number
  try {
    const res = await listAccounts(db, filter, page, pageSize)
    data = res.rows
    count = res.total
  } catch (error) {
    console.error('Liste des clients :', error)
    return NextResponse.json({ success: false, message: 'Lecture des clients impossible.' }, { status: 500 })
  }
  const { data: segmentCounts } = await db.rpc('admin_account_counts')
  // Accès, commandes : lus pour les 30 comptes de la page seulement (jamais pour toute la base).
  const ids = data.map((c) => c.id)
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
  return NextResponse.json({ success: true, total: count, pageSize, counts: segmentCounts ?? null, customers: data.map(omitTotal).map((c) => ({ ...c, purchases: counts.get(c.id) ?? 0, pro: pro.has(c.id), status: status(c.id), pending: pending.has(c.id), payment_method: method.get(c.id) ?? null })) })
}

/** total_count (même valeur sur chaque ligne) ne part pas dans la liste : il est déjà dans « total ». */
function omitTotal(row: AccountRow): Omit<AccountRow, 'total_count'> {
  const copy: Partial<AccountRow> = { ...row }
  delete copy.total_count
  return copy as Omit<AccountRow, 'total_count'>
}
