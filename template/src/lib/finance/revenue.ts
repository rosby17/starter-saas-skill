import type { SupabaseClient } from '@supabase/supabase-js'
import { TZ_OFFSET_MS, localDay } from '@/lib/time'
import { addDays, daysBetween, feeRateAt, fixedAndOneOffCharges, methodKey, methodLabel, type ChargeLine, type ChargeRow, type FeeRateRow, type ProviderRateRow } from './charges'
import { DISCOUNT_REASONS, reasonInfo } from './adjustments'
import { toFcfa, type Currency } from './money'
import { getAdminCurrency, loadFcfaPer, providerCosts, readAll } from './server'
import { GROUPS, MAX_HOURLY_DAYS, type Group } from './period'

// Page Administration › Revenus : tout ce qui concerne l'argent, CALCULÉ ici, côté serveur.
//  · ventes = commandes payées (status 'success'), commandes de test exclues, datées à l'encaissement (paid_at) ;
//  · montants en FCFA (référence comptable), convertis à l'AFFICHAGE dans la devise de l'administration ;
//  · jours, heures et mois à l'heure de la plateforme (site.timezone), jamais à celle du navigateur.

export { GROUPS, MAX_HOURLY_DAYS, type Group } from './period'
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

type OrderRow = {
  id: string; user_id: string | null; plan_name: string | null; credits: number | null
  amount_fcfa: number | null; paid_amount_fcfa: number | null; amount_local: number | null; currency: string | null
  payment_method: string | null; created_at: string; paid_at: string | null
  customer_name: string | null; customer_email: string | null
  product: { title: string | null; category: string | null } | null
}
type AdjustmentRow = {
  id: string; reason: string; user_id: string | null; customer_label: string | null; credits: number | null
  paid_fcfa: number; list_price_fcfa: number; payment_method: string | null; note: string | null; occurred_at: string
}

/** Montant encaissé d'une commande en FCFA : encaissé réel, sinon demandé, sinon montant local converti. */
function orderFcfa(o: OrderRow): number {
  if (o.paid_amount_fcfa != null) return Number(o.paid_amount_fcfa)
  if (o.amount_fcfa != null) return Number(o.amount_fcfa)
  const cur = (o.currency || 'XAF').toUpperCase()
  if (['XAF', 'XOF', 'FCFA'].includes(cur)) return Number(o.amount_local) || 0
  return toFcfa(Number(o.amount_local) || 0, cur === 'EUR' ? 'EUR' : 'USD')
}

const pct = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : now > 0 ? 100 : 0)
const localHour = (iso: string) => new Date(new Date(iso).getTime() + TZ_OFFSET_MS).toISOString().slice(0, 13)
/** Début (inclus) d'un jour local, en ISO UTC. */
export const dayStartIso = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - TZ_OFFSET_MS).toISOString()

function bucketOf(day: string, group: Group): string {
  if (group === 'day') return day
  if (group === 'month') return day.slice(0, 7)
  if (group === 'year') return day.slice(0, 4)
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7 // lundi = 0
  return addDays(day, -weekday)
}

/** Toutes les tranches de la période, sans trou (jours sans vente compris). */
function bucketsBetween(from: string, to: string, group: Group): string[] {
  const keys: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (group === 'hour') { for (let h = 0; h < 24; h++) keys.push(`${day}T${String(h).padStart(2, '0')}`); continue }
    const key = bucketOf(day, group)
    if (keys[keys.length - 1] !== key) keys.push(key)
  }
  return keys
}

type Slice = { key: string; label: string; revenue: number; count: number; sharePct: number; previous: number; growthPct: number | null }

/** Part et évolution de chaque canal (moyen de paiement, offre…) face à la période précédente de même longueur. */
function slices(now: OrderRow[], before: OrderRow[], keyOf: (o: OrderRow) => string, labelOf: (o: OrderRow) => string): Slice[] {
  const map = new Map<string, Slice>()
  const get = (o: OrderRow) => {
    const key = keyOf(o)
    return map.get(key) ?? map.set(key, { key, label: labelOf(o), revenue: 0, count: 0, sharePct: 0, previous: 0, growthPct: null }).get(key)!
  }
  for (const o of now) { const s = get(o); s.revenue += orderFcfa(o); s.count += 1 }
  for (const o of before) get(o).previous += orderFcfa(o)
  const total = [...map.values()].reduce((sum, s) => sum + s.revenue, 0)
  return [...map.values()]
    .map((s) => ({ ...s, sharePct: total > 0 ? (s.revenue / total) * 100 : 0, growthPct: s.previous > 0 ? pct(s.revenue, s.previous) : null }))
    .filter((s) => s.revenue > 0 || s.previous > 0)
    .sort((a, b) => b.revenue - a.revenue || b.previous - a.previous)
}

export async function buildRevenueReport(db: SupabaseClient, params: URLSearchParams) {
  const today = localDay(Date.now())
  let to = DAY_RE.test(params.get('to') || '') ? params.get('to')! : today
  let from = DAY_RE.test(params.get('from') || '') ? params.get('from')! : `${today.slice(0, 7)}-01`
  if (from > to) [from, to] = [to, from]
  const days = daysBetween(from, to)
  const asked = GROUPS.includes(params.get('group') as Group) ? (params.get('group') as Group) : 'day'
  const group: Group = asked === 'hour' && days > MAX_HOURLY_DAYS ? 'day' : asked

  const [currency, fcfaPer, ordersRes, pendingRes, chargesRes, feeRes, providerRes] = await Promise.all([
    getAdminCurrency(db),
    loadFcfaPer(db),
    readAll<OrderRow>(() => db.from('orders')
      .select('id, user_id, plan_name, credits, amount_fcfa, paid_amount_fcfa, amount_local, currency, payment_method, created_at, paid_at, customer_name, customer_email, product:products(title, category)')
      .eq('status', 'success').eq('is_test', false).order('created_at') as never),
    db.from('orders').select('status, amount_fcfa, created_at').eq('is_test', false).in('status', ['pending', 'failed', 'cancelled', 'expired']).gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(5000),
    db.from('finance_charges').select('id, label, family, amount, currency, period, share_pct, free, starts_on, ends_on, note'),
    db.from('payment_fee_rates').select('id, method, percent, valid_from'),
    db.from('provider_rates').select('id, provider, service, label, amount, currency, per_units, unit, valid_from, note'),
  ])
  for (const r of [pendingRes, chargesRes, feeRes, providerRes]) if (r.error) throw new Error(r.error.message)

  // Chaque vente datée à l'encaissement, au jour local.
  const paid = ordersRes.rows.map((o) => ({ o, at: o.paid_at || o.created_at })).map((x) => ({ ...x, day: localDay(x.at) }))
  paid.sort((a, b) => a.at.localeCompare(b.at))
  const between = (a: string, b: string) => paid.filter((x) => x.day >= a && x.day <= b).map((x) => x.o)
  const sum = (rows: OrderRow[]) => rows.reduce((s, o) => s + orderFcfa(o), 0)
  const buyer = (o: OrderRow) => o.user_id || o.customer_email || o.id

  // ---- Chiffres clés (indépendants de la période) ----
  const yesterday = addDays(today, -1)
  const month = today.slice(0, 7)
  const prevMonthEnd = addDays(`${month}-01`, -1)
  const prevMonth = prevMonthEnd.slice(0, 7)
  const dayOfMonth = Number(today.slice(8, 10))
  const prevSameDay = `${prevMonth}-${String(Math.min(dayOfMonth, Number(prevMonthEnd.slice(8, 10)))).padStart(2, '0')}`
  const monthRows = between(`${month}-01`, today)
  const prevMonthRows = between(`${prevMonth}-01`, prevMonthEnd)
  const prevToDate = between(`${prevMonth}-01`, prevSameDay)
  const week = between(addDays(today, -6), today)
  const prevWeek = between(addDays(today, -13), addDays(today, -7))
  const firstDay = new Map<string, string>()
  for (const x of paid) if (!firstDay.has(buyer(x.o))) firstDay.set(buyer(x.o), x.day)
  const monthBuyers = new Set(monthRows.map(buyer))
  const prevBuyers = new Set(prevMonthRows.map(buyer))
  const newThisMonth = [...monthBuyers].filter((b) => (firstDay.get(b) || '').startsWith(month)).length
  const repurchased = [...prevBuyers].filter((b) => monthBuyers.has(b)).length
  const monthDays = Number(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate())
  const perBuyer = new Map<string, number>()
  for (const x of paid) perBuyer.set(buyer(x.o), (perBuyer.get(buyer(x.o)) ?? 0) + 1)
  const allRevenue = sum(paid.map((x) => x.o))

  // ---- Période choisie ----
  const prevTo = addDays(from, -1)
  const prevFrom = addDays(from, -days)
  const rows = between(from, to)
  const prevRows = between(prevFrom, prevTo)
  const index = new Map(bucketsBetween(from, to, group).map((k, i) => [k, i]))
  const series = [...index.keys()].map((key) => ({ key, revenue: 0, count: 0 }))
  for (const x of paid) {
    if (x.day < from || x.day > to) continue
    const i = index.get(group === 'hour' ? localHour(x.at) : bucketOf(x.day, group))
    if (i !== undefined) { series[i].revenue += orderFcfa(x.o); series[i].count += 1 }
  }
  const periodBuyers = new Set(rows.map(buyer))
  const periodNew = [...periodBuyers].filter((b) => { const f = firstDay.get(b) || ''; return f >= from && f <= to }).length
  const revenue = sum(rows)

  // 12 derniers mois (tableau « Par mois »).
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const key = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 - (11 - i), 1)).toISOString().slice(0, 7)
    const r = paid.filter((x) => x.day.startsWith(key)).map((x) => x.o)
    return { month: key, revenue: sum(r), count: r.length, customers: new Set(r.map(buyer)).size }
  })

  // Meilleurs clients de la période.
  const topMap = new Map<string, { id: string; userId: string | null; name: string; email: string; revenue: number; count: number }>()
  for (const o of rows) {
    const k = buyer(o)
    const t = topMap.get(k) ?? { id: k, userId: o.user_id, name: o.customer_name || '', email: o.customer_email || '', revenue: 0, count: 0 }
    t.revenue += orderFcfa(o); t.count += 1
    if (!t.name && o.customer_name) t.name = o.customer_name
    if (!t.email && o.customer_email) t.email = o.customer_email
    topMap.set(k, t)
  }
  const top = [...topMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // ---- Mouvements hors passerelle (motifs) de la période ----
  const fromIso = dayStartIso(from)
  const toIso = dayStartIso(addDays(to, 1))
  const adj = await readAll<AdjustmentRow>(() => db.from('money_adjustments')
    .select('id, reason, user_id, customer_label, credits, paid_fcfa, list_price_fcfa, payment_method, note, occurred_at')
    .gte('occurred_at', fromIso).lt('occurred_at', toIso).order('occurred_at', { ascending: false }) as never, 20_000)
  const byReason: Record<string, { count: number; credits: number; paid: number; catalog: number; discount: number }> = {}
  let manualIn = 0
  let refunds = 0
  for (const a of adj.rows) {
    const info = reasonInfo(a.reason)
    const k = (byReason[a.reason] ??= { count: 0, credits: 0, paid: 0, catalog: 0, discount: 0 })
    const paidFcfa = Number(a.paid_fcfa) || 0
    const catalog = Number(a.list_price_fcfa) || 0
    k.count += 1; k.credits += a.credits || 0; k.paid += paidFcfa; k.catalog += catalog
    if (DISCOUNT_REASONS.includes(a.reason as never)) k.discount += Math.max(0, catalog - paidFcfa)
    if (info?.money === 'in') manualIn += paidFcfa
    if (info?.money === 'out') refunds += paidFcfa
  }

  // ---- Charges et marge réelle ----
  const feeRates = (feeRes.data ?? []) as FeeRateRow[]
  const fees = new Map<string, ChargeLine>()
  const feeOf = (method: string | null, amount: number, day: string) => {
    const key = methodKey(method)
    const line = fees.get(key) ?? { id: `f:${key}`, label: methodLabel(method), family: 'frais' as const, fcfa: 0, revenue: 0, count: 0, rate: 0 }
    line.revenue = (line.revenue ?? 0) + amount
    line.count = (line.count ?? 0) + 1
    line.fcfa += amount * feeRateAt(feeRates, method, day) / 100
    // Taux affiché = taux moyen réel (le tarif a pu changer pendant la période).
    line.rate = line.revenue ? (line.fcfa / line.revenue) * 100 : 0
    fees.set(key, line)
  }
  for (const x of paid) if (x.day >= from && x.day <= to) feeOf(x.o.payment_method, orderFcfa(x.o), x.day)
  for (const a of adj.rows) if (reasonInfo(a.reason)?.money === 'in' && Number(a.paid_fcfa) > 0) feeOf(a.payment_method, Number(a.paid_fcfa), localDay(a.occurred_at))

  let variable: ChargeLine[] = []
  let variableError = false
  let variableTruncated = false
  try {
    const res = await providerCosts(db, (providerRes.data ?? []) as ProviderRateRow[], fromIso, toIso, fcfaPer)
    variable = res.lines
    variableTruncated = res.truncated
  } catch (error) {
    variableError = true
    console.error('Coût des fournisseurs :', error)
  }
  const fixedLines = fixedAndOneOffCharges((chargesRes.data ?? []) as ChargeRow[], from, to, fcfaPer)
  const feeLines = [...fees.values()].sort((a, b) => b.fcfa - a.fcfa)
  const total = (lines: ChargeLine[]) => lines.reduce((s, l) => s + l.fcfa, 0)
  const income = revenue + manualIn - refunds
  const chargesTotal = total(feeLines) + total(variable) + total(fixedLines)
  const net = income - chargesTotal

  // Noms des clients sans coordonnées sur la commande (anciennes commandes) et des mouvements manuels.
  const ids = [...new Set([...top.filter((t) => t.userId && !t.email).map((t) => t.userId!), ...adj.rows.filter((a) => a.user_id && !a.customer_label).map((a) => a.user_id!)])].slice(0, 60)
  const emails: Record<string, string> = {}
  await Promise.all(ids.map(async (id) => {
    const { data } = await db.auth.admin.getUserById(id)
    if (data?.user?.email) emails[id] = data.user.email
  }))

  return {
    currency: currency as Currency,
    fcfaPer,
    today,
    truncated: ordersRes.truncated || adj.truncated || variableTruncated,
    kpis: {
      today: { revenue: sum(between(today, today)), count: between(today, today).length },
      yesterday: { revenue: sum(between(yesterday, yesterday)), count: between(yesterday, yesterday).length },
      week: { revenue: sum(week), count: week.length, previous: sum(prevWeek), growthPct: pct(sum(week), sum(prevWeek)) },
      month: {
        key: month, revenue: sum(monthRows), count: monthRows.length,
        previous: sum(prevMonthRows), previousToDate: sum(prevToDate), growthToDatePct: pct(sum(monthRows), sum(prevToDate)),
        projection: dayOfMonth ? (sum(monthRows) / dayOfMonth) * monthDays : 0,
        averageOrder: monthRows.length ? sum(monthRows) / monthRows.length : 0,
        customers: monthBuyers.size, newCustomers: newThisMonth, repurchased, previousCustomers: prevBuyers.size,
      },
      allTime: {
        revenue: allRevenue, count: paid.length, customers: perBuyer.size,
        averageOrder: paid.length ? allRevenue / paid.length : 0,
        revenuePerCustomer: perBuyer.size ? allRevenue / perBuyer.size : 0,
        repeatCustomers: [...perBuyer.values()].filter((n) => n > 1).length,
        firstSale: paid[0]?.at ?? null,
      },
    },
    toHandle: {
      pending: (pendingRes.data ?? []).filter((o) => o.status === 'pending').length,
      pendingFcfa: (pendingRes.data ?? []).filter((o) => o.status === 'pending').reduce((s, o) => s + (Number(o.amount_fcfa) || 0), 0),
      failed: (pendingRes.data ?? []).filter((o) => o.status !== 'pending').length,
    },
    monthly,
    period: {
      from, to, group, days,
      revenue, count: rows.length, customers: periodBuyers.size, newCustomers: periodNew,
      averageOrder: rows.length ? revenue / rows.length : 0,
      credits: rows.reduce((s, o) => s + (o.credits || 0), 0),
      previous: { from: prevFrom, to: prevTo, revenue: sum(prevRows), count: prevRows.length },
      growthPct: pct(revenue, sum(prevRows)),
      series,
      byMethod: slices(rows, prevRows, (o) => methodKey(o.payment_method), (o) => methodLabel(o.payment_method)),
      byProduct: slices(rows, prevRows, (o) => o.product?.title || o.plan_name || 'Sans offre', (o) => o.product?.title || o.plan_name || 'Sans offre'),
      top: top.map((t) => ({ ...t, email: t.email || (t.userId ? emails[t.userId] : '') || '' })),
      // Chaque vente avec son heure exacte, les plus récentes d'abord.
      sales: rows.slice().reverse().slice(0, 200).map((o) => ({
        id: o.id, userId: o.user_id, name: o.customer_name || '', email: o.customer_email || '',
        offer: o.product?.title || o.plan_name || 'Sans offre', method: methodLabel(o.payment_method),
        amount: orderFcfa(o), credits: o.credits || 0, at: o.paid_at || o.created_at,
      })),
      salesTotal: rows.length,
      adjustments: {
        byReason, manualIn, refunds,
        list: adj.rows.slice(0, 100).map((a) => ({
          id: a.id, reason: a.reason, userId: a.user_id, who: a.customer_label || (a.user_id ? emails[a.user_id] : '') || '',
          credits: a.credits, paid: Number(a.paid_fcfa) || 0, catalog: Number(a.list_price_fcfa) || 0,
          method: a.payment_method, note: a.note, at: a.occurred_at,
        })),
      },
      margin: {
        revenue, manualIn, refunds, income,
        fees: feeLines, variable, fixed: fixedLines.filter((l) => l.family === 'fixe'), oneOff: fixedLines.filter((l) => l.family === 'ponctuelle'),
        feesTotal: total(feeLines), variableTotal: total(variable), fixedTotal: total(fixedLines.filter((l) => l.family === 'fixe')), oneOffTotal: total(fixedLines.filter((l) => l.family === 'ponctuelle')),
        chargesTotal, net, netPct: income > 0 ? (net / income) * 100 : null,
        variableError,
        missing: fixedLines.filter((l) => l.missing).map((l) => l.label),
        unpriced: variable.filter((l) => (l.unpriced ?? 0) > 0).map((l) => l.label),
      },
    },
  }
}

export type RevenueReport = Awaited<ReturnType<typeof buildRevenueReport>>
