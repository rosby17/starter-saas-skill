import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { hasModule } from '@/config/site'
import { localDay, TZ_OFFSET_MS } from '@/lib/time'

// Photo du SaaS pour le coach : chiffre d'affaires, comportements agrégés, groupes de clients à contacter.
// RÈGLE : le modèle ne reçoit JAMAIS d'identité (nom, e-mail, téléphone). Il voit des nombres et des
// « Client 1, Client 2… » ; les vrais clients sont retrouvés chez nous à l'affichage (contacts.ts).

const DAY = 86_400_000
const PAGE = 1000
const MAX_ROWS = 50_000
const AUDIENCE_LIMIT = 40
const HIGH_INTENT_LIMIT = 15

/** Groupes de clients que le coach peut choisir pour une action « contacter ». */
export const COACH_AUDIENCES = {
  abandoned_checkout: 'Paiement commencé ces 14 derniers jours mais jamais abouti (relancer, aider à payer)',
  new_never_paid: 'Inscrits depuis moins de 30 jours, jamais acheté (premier achat)',
  lapsed_buyers: 'Anciens acheteurs sans achat depuis plus de 60 jours (faire revenir)',
  loyal_buyers: 'Clients fidèles : au moins 2 achats, le dernier il y a moins de 90 jours (remercier, offre suivante)',
  low_credits: 'Acheteurs de crédits dont le solde est presque épuisé (recharger)',
} as const
export type CoachAudience = keyof typeof COACH_AUDIENCES

type ProfileRow = { id: string; created_at: string; country: string | null; is_admin: boolean | null }
type OrderRow = {
  user_id: string; status: string; created_at: string; paid_at: string | null; amount_fcfa: number | null; paid_amount_fcfa: number | null
  product_id: string | null; plan_name: string | null; payment_method: string | null; is_test: boolean | null; credits: number | null
}
type EventRow = { user_id: string | null; action: string; status: string; created_at: string }

type Paged<T> = { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }

async function fetchAll<T>(build: () => Paged<T>, optional = false): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) {
      if (optional) return rows
      throw new Error(error.message)
    }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return rows
}

const amountOf = (o: OrderRow) => Number(o.paid_amount_fcfa ?? o.amount_fcfa ?? 0)
const paidAt = (o: OrderRow) => o.paid_at || o.created_at
const percent = (part: number, total: number) => (total ? Math.round((part / total) * 100) : null)
const median = (values: number[]) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}
function shares(counts: Map<string, number>, limit = 5) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count, share: percent(count, total) }))
}

export type HighIntentCandidate = { id: string; score: number; reasons: string[]; purchases: number; lastPurchaseDays: number | null; signupDays: number; actions7d: number }

export type CoachSnapshot = {
  generatedAt: string
  revenue: { goal: number; last30d: number; previous30d: number; last7d: number; orders30d: number; payingCustomers30d: number; averageOrder: number; goalProgress: number }
  totals: { customers: number; signups30d: number; active30d: number; buyersEver: number }
  audiences: Record<CoachAudience, string[]>
  highIntent: HighIntentCandidate[]
  behaviour: Record<string, unknown>
}

export async function buildCoachSnapshot(db: SupabaseClient, { goal, excludeIds = [] }: { goal: number; excludeIds?: Iterable<string> }): Promise<CoachSnapshot> {
  const now = Date.now()
  const since = (days: number) => new Date(now - days * DAY).toISOString()
  const excluded = new Set(excludeIds)

  const [profiles, orders, events, products, requests] = await Promise.all([
    fetchAll<ProfileRow>(() => db.from('profiles').select('id, created_at, country, is_admin').order('created_at') as unknown as Paged<ProfileRow>),
    fetchAll<OrderRow>(() => db.from('orders').select('user_id, status, created_at, paid_at, amount_fcfa, paid_amount_fcfa, product_id, plan_name, payment_method, is_test, credits').gte('created_at', since(365)).order('created_at') as unknown as Paged<OrderRow>),
    // Fil d'activité : facultatif (migration 20261026110000) ; sans lui, l'activité est déduite des commandes.
    fetchAll<EventRow>(() => db.from('activity_events').select('user_id, action, status, created_at').gte('created_at', since(30)).order('created_at') as unknown as Paged<EventRow>, true),
    db.from('products').select('id, title, category').then((r) => r.data ?? []),
    db.from('service_requests').select('id', { count: 'exact', head: true }).gte('created_at', since(30)).then((r) => r.count ?? 0),
  ])

  const admins = new Set(profiles.filter((p) => p.is_admin).map((p) => p.id))
  const customers = profiles.filter((p) => !p.is_admin)
  const real = orders.filter((o) => !o.is_test && !admins.has(o.user_id))
  const paid = real.filter((o) => o.status === 'success')
  const productTitle = new Map(products.map((p) => [p.id as string, `${p.title} (${p.category})`]))

  // --- Chiffre d'affaires
  const inWindow = (o: OrderRow, from: number, to = 0) => { const t = new Date(paidAt(o)).getTime(); return t >= now - from * DAY && t < now - to * DAY }
  const paid30 = paid.filter((o) => inWindow(o, 30))
  const last30d = paid30.reduce((s, o) => s + amountOf(o), 0)
  const revenue = {
    goal,
    last30d,
    previous30d: paid.filter((o) => inWindow(o, 60, 30)).reduce((s, o) => s + amountOf(o), 0),
    last7d: paid.filter((o) => inWindow(o, 7)).reduce((s, o) => s + amountOf(o), 0),
    orders30d: paid30.length,
    payingCustomers30d: new Set(paid30.map((o) => o.user_id)).size,
    averageOrder: paid30.length ? Math.round(last30d / paid30.length) : 0,
    goalProgress: goal ? Math.round((last30d / goal) * 100) : 0,
  }

  // --- Par client
  const purchases = new Map<string, OrderRow[]>()
  for (const o of paid) purchases.set(o.user_id, [...(purchases.get(o.user_id) ?? []), o])
  const actions7d = new Map<string, number>()
  const active30 = new Set<string>()
  for (const e of events) {
    if (!e.user_id || admins.has(e.user_id)) continue
    active30.add(e.user_id)
    if (new Date(e.created_at).getTime() >= now - 7 * DAY) actions7d.set(e.user_id, (actions7d.get(e.user_id) ?? 0) + 1)
  }
  for (const o of real) if (new Date(o.created_at).getTime() >= now - 30 * DAY) active30.add(o.user_id)

  // Paniers abandonnés : commande non aboutie récente, sans paiement réussi depuis.
  const abandoned = new Map<string, number>()
  for (const o of real) {
    if (o.status === 'success' || new Date(o.created_at).getTime() < now - 14 * DAY) continue
    const paidAfter = (purchases.get(o.user_id) ?? []).some((p) => paidAt(p) >= o.created_at)
    if (!paidAfter) abandoned.set(o.user_id, Math.max(abandoned.get(o.user_id) ?? 0, new Date(o.created_at).getTime()))
  }

  // Soldes de crédits (module crédits seulement).
  const balances = new Map<string, number>()
  if (hasModule('credits')) {
    const ledger = await fetchAll<{ user_id: string; amount: number }>(() => db.from('credits').select('user_id, amount').order('created_at') as unknown as Paged<{ user_id: string; amount: number }>, true)
    for (const row of ledger) balances.set(row.user_id, (balances.get(row.user_id) ?? 0) + (row.amount || 0))
  }

  const audiences: Record<CoachAudience, string[]> = { abandoned_checkout: [], new_never_paid: [], lapsed_buyers: [], loyal_buyers: [], low_credits: [] }
  const candidates: HighIntentCandidate[] = []
  for (const c of customers) {
    if (excluded.has(c.id)) continue
    const bought = purchases.get(c.id) ?? []
    const last = bought.length ? Math.max(...bought.map((o) => new Date(paidAt(o)).getTime())) : null
    const signupDays = Math.floor((now - new Date(c.created_at).getTime()) / DAY)
    const lastDays = last ? Math.floor((now - last) / DAY) : null
    if (abandoned.has(c.id)) audiences.abandoned_checkout.push(c.id)
    if (!bought.length && signupDays < 30) audiences.new_never_paid.push(c.id)
    if (lastDays !== null && lastDays > 60) audiences.lapsed_buyers.push(c.id)
    if (bought.length >= 2 && lastDays !== null && lastDays < 90) audiences.loyal_buyers.push(c.id)
    const lastCredits = [...bought].reverse().find((o) => (o.credits ?? 0) > 0)?.credits ?? 0
    if (hasModule('credits') && lastCredits > 0 && (balances.get(c.id) ?? 0) < lastCredits * 0.2) audiences.low_credits.push(c.id)

    const reasons: string[] = []
    let score = 0
    if (abandoned.has(c.id)) { score += 40; reasons.push('paiement commencé non abouti') }
    const recent = actions7d.get(c.id) ?? 0
    if (recent) { score += Math.min(25, recent * 5); reasons.push(`${recent} action(s) cette semaine`) }
    if (bought.length) { score += Math.min(20, bought.length * 7); reasons.push(`${bought.length} achat(s)`) }
    if (signupDays < 7) { score += 10; reasons.push('inscrit cette semaine') }
    if (score >= 25) candidates.push({ id: c.id, score, reasons, purchases: bought.length, lastPurchaseDays: lastDays, signupDays, actions7d: recent })
  }
  for (const key of Object.keys(audiences) as CoachAudience[]) audiences[key] = audiences[key].slice(0, AUDIENCE_LIMIT)
  const highIntent = candidates.sort((a, b) => b.score - a.score).slice(0, HIGH_INTENT_LIMIT)

  // --- Comportements agrégés (matière des idées de fonctionnalités)
  const signups30 = customers.filter((c) => new Date(c.created_at).getTime() >= now - 30 * DAY)
  const firstPurchaseDelays = customers.flatMap((c) => {
    const first = (purchases.get(c.id) ?? [])[0]
    return first ? [Math.max(0, Math.round((new Date(paidAt(first)).getTime() - new Date(c.created_at).getTime()) / DAY))] : []
  })
  const buyers = [...purchases.keys()].filter((id) => !admins.has(id))
  const orders30 = real.filter((o) => new Date(o.created_at).getTime() >= now - 30 * DAY)
  const productStats = new Map<string, { count: number; revenue: number }>()
  for (const o of paid30) {
    const name = (o.product_id && productTitle.get(o.product_id)) || o.plan_name || 'Autre'
    const s = productStats.get(name) ?? { count: 0, revenue: 0 }
    productStats.set(name, { count: s.count + 1, revenue: s.revenue + amountOf(o) })
  }
  const methods = new Map<string, number>()
  const hours = new Map<string, number>()
  for (const o of paid30) {
    methods.set(o.payment_method || 'inconnu', (methods.get(o.payment_method || 'inconnu') ?? 0) + 1)
    const hour = new Date(new Date(paidAt(o)).getTime() + TZ_OFFSET_MS).getUTCHours()
    hours.set(`${hour} h`, (hours.get(`${hour} h`) ?? 0) + 1)
  }
  const countryOf = new Map(profiles.map((p) => [p.id, p.country]))
  const countries = new Map<string, number>()
  for (const id of buyers) {
    const country = countryOf.get(id) || 'inconnu'
    countries.set(country, (countries.get(country) ?? 0) + 1)
  }
  const actions = new Map<string, { total: number; failed: number }>()
  for (const e of events) {
    const a = actions.get(e.action) ?? { total: 0, failed: 0 }
    actions.set(e.action, { total: a.total + 1, failed: a.failed + (e.status === 'failed' ? 1 : 0) })
  }
  const revenueByDay = new Map<string, number>()
  for (const o of paid.filter((x) => inWindow(x, 14))) revenueByDay.set(localDay(paidAt(o)), (revenueByDay.get(localDay(paidAt(o))) ?? 0) + amountOf(o))

  const behaviour = {
    signups30d: signups30.length,
    shareOfCustomersWhoPaid: percent(buyers.length, customers.length),
    signups30dWhoPaid: percent(signups30.filter((c) => purchases.has(c.id)).length, signups30.length),
    medianDaysToFirstPurchase: median(firstPurchaseDelays),
    repurchaseRate: percent(buyers.filter((id) => (purchases.get(id)?.length ?? 0) >= 2).length, buyers.length),
    paymentFailureRate30d: percent(orders30.filter((o) => ['failed', 'cancelled'].includes(o.status)).length, orders30.length),
    pendingCheckouts14d: abandoned.size,
    topProducts30d: [...productStats.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6).map(([name, s]) => ({ name, ...s })),
    paymentMethods30d: shares(methods),
    buyerCountries: shares(countries),
    purchaseHours30d: shares(hours, 4),
    actions30d: [...actions.entries()].map(([action, v]) => ({ action, ...v })).sort((a, b) => b.total - a.total).slice(0, 12),
    requests30d: requests,
    revenueByDay14d: Object.fromEntries([...revenueByDay.entries()].sort()),
    creditsModule: hasModule('credits'),
  }

  return {
    generatedAt: new Date(now).toISOString(),
    revenue,
    totals: { customers: customers.length, signups30d: signups30.length, active30d: active30.size, buyersEver: buyers.length },
    audiences,
    highIntent,
    behaviour,
  }
}

/** Ce qui part chez le modèle : des nombres, des groupes comptés et des « Client N » sans identité. */
export function anonymizeForModel(snapshot: CoachSnapshot) {
  return {
    chiffreAffaires: { ...snapshot.revenue, devise: 'FCFA' },
    clients: snapshot.totals,
    groupes: Object.fromEntries((Object.keys(COACH_AUDIENCES) as CoachAudience[]).map((key) => [key, { description: COACH_AUDIENCES[key], nombre: snapshot.audiences[key].length }])),
    forteIntention: snapshot.highIntent.map((c, index) => ({ client: `Client ${index + 1}`, score: c.score, raisons: c.reasons, achats: c.purchases, dernierAchatIlYaJours: c.lastPurchaseDays, inscritIlYaJours: c.signupDays })),
    comportements: snapshot.behaviour,
  }
}
