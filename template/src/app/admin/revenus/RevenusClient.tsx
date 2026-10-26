'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { clsx } from '@/lib/utils'
import { DatePicker } from '@/components/ui/date-picker'
import { Notice } from '@/components/admin/kit'
import { AdminCurrencyProvider, AdminCurrencySwitcher, useAdminCurrency } from '@/components/admin/AdminCurrency'
import { TZ_IANA, TZ_LABEL, TZ_OFFSET_MS } from '@/lib/time'
import type { RevenueReport } from '@/lib/finance/revenue'
import { MAX_HOURLY_DAYS, type Group } from '@/lib/finance/period'
import { RevenueChart } from './RevenueChart'
import { MarginCard, ChargesPanel } from './ChargesPanel'
import { AdjustmentsPanel } from './AdjustmentsPanel'
import { Card, Growth, Kpi } from './ui'

// Administration › Revenus : chiffre d'affaires par période (heure → année), chaque vente avec son heure, part et
// évolution par canal, mouvements hors passerelle (motifs), charges en trois familles et marge réelle.
// Tout est calculé par /api/admin/finance/revenue en FCFA, affiché dans la devise de l'administration.

type Period = RevenueReport['period']
type Slice = Period['byMethod'][number]

const n = (v: number) => Math.round(v).toLocaleString('fr-FR')
const localToday = () => new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10)
const addDays = (day: string, d: number) => new Date(Date.parse(`${day}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10)
const shortDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const monthLabel = (key: string) => new Date(`${key}-01T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const saleTime = (iso: string, withDay: boolean) =>
  new Date(iso).toLocaleString('fr-FR', { timeZone: TZ_IANA, ...(withDay ? { day: 'numeric', month: 'short' } : {}), hour: '2-digit', minute: '2-digit' })

type Preset = 'today' | 'week' | 'month' | 'lastMonth' | 'last30' | 'quarter' | 'year' | 'last12' | 'custom'
const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Aujourd’hui' }, { value: 'week', label: 'Cette semaine' }, { value: 'month', label: 'Ce mois' },
  { value: 'lastMonth', label: 'Mois dernier' }, { value: 'last30', label: '30 jours' }, { value: 'quarter', label: '3 mois' },
  { value: 'year', label: 'Cette année' }, { value: 'last12', label: '12 mois' }, { value: 'custom', label: 'Personnalisé' },
]
const GROUP_LABELS: { value: Group; label: string }[] = [
  { value: 'hour', label: 'Heure' }, { value: 'day', label: 'Jour' }, { value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }, { value: 'year', label: 'Année' },
]

function presetRange(preset: Preset): { from: string; to: string; group: Group } {
  const today = localToday()
  const monthStart = `${today.slice(0, 7)}-01`
  switch (preset) {
    case 'today': return { from: today, to: today, group: 'hour' }
    case 'week': return { from: addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7)), to: today, group: 'day' }
    case 'lastMonth': { const end = addDays(monthStart, -1); return { from: `${end.slice(0, 7)}-01`, to: end, group: 'day' } }
    case 'last30': return { from: addDays(today, -29), to: today, group: 'day' }
    case 'quarter': return { from: addDays(today, -89), to: today, group: 'week' }
    case 'year': return { from: `${today.slice(0, 4)}-01-01`, to: today, group: 'month' }
    case 'last12': { const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 12, 1)); return { from: d.toISOString().slice(0, 10), to: today, group: 'month' } }
    default: return { from: monthStart, to: today, group: 'day' }
  }
}

export function RevenusClient() {
  return <AdminCurrencyProvider><Revenus /></AdminCurrencyProvider>
}

function Revenus() {
  const { format } = useAdminCurrency()
  const [report, setReport] = useState<RevenueReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<Preset>('month')
  const [range, setRange] = useState(() => presetRange('month'))
  const query = useMemo(() => `from=${range.from}&to=${range.to}&group=${range.group}`, [range])

  const load = useCallback(() => {
    setLoading(true)
    return fetch(`/api/admin/finance/revenue?${query}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (!d.success) throw new Error(d.message || 'Chargement impossible.'); setReport(d.report); setError(null) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Chargement impossible.'))
      .finally(() => setLoading(false))
  }, [query])
  useEffect(() => { void load() }, [load])

  const pick = (value: Preset) => { setPreset(value); if (value !== 'custom') setRange(presetRange(value)) }
  const setCustom = (patch: Partial<typeof range>) => {
    setPreset('custom')
    setRange((cur) => {
      const next = { ...cur, ...patch }
      // Plus de 7 jours : le regroupement par heure passe au jour.
      const days = (Date.parse(next.to) - Date.parse(next.from)) / 86_400_000 + 1
      return next.group === 'hour' && days > MAX_HOURLY_DAYS ? { ...next, group: 'day' } : next
    })
  }

  if (!report) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        {error ? <Notice tone="red">{error}</Notice> : <p className="text-sm text-gray-500">Calcul des revenus…</p>}
      </main>
    )
  }

  const k = report.kpis
  const m = k.month
  const p = report.period

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl">Revenus</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Ventes payées seulement (commandes de test exclues), datées à l’encaissement, {TZ_LABEL}. Charges et marge réelle calculées sur la même période.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <AdminCurrencySwitcher className="min-w-0 flex-1 sm:w-56 sm:flex-none" />
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm font-medium hover:bg-gray-100 disabled:opacity-50">
            {loading ? 'Calcul…' : 'Actualiser'}
          </button>
        </div>
      </header>

      {error && <Notice tone="red">{error}</Notice>}
      {report.truncated && <Notice>Très gros volume : une partie de l’historique n’a pas été lue. Réduisez la période pour un chiffre exact.</Notice>}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Aujourd’hui" value={format(k.today.revenue)} hint={`${k.today.count} vente${k.today.count > 1 ? 's' : ''} · hier ${format(k.yesterday.revenue)}`} trend={trend(k.today.revenue, k.yesterday.revenue)} />
        <Kpi label="7 derniers jours" value={format(k.week.revenue)} hint={`${k.week.count} ventes · 7 jours d’avant ${format(k.week.previous)}`} trend={k.week.growthPct} />
        <Kpi label={`Ce mois (${monthLabel(m.key)})`} value={format(m.revenue)} hint={`même période le mois dernier : ${format(m.previousToDate)}`} trend={m.growthToDatePct} highlight />
        <Kpi label="Mois dernier (complet)" value={format(m.previous)} hint={`projection de ce mois : ${format(m.projection)}`} />
        <Kpi label="Panier moyen (mois)" value={format(m.averageOrder)} hint={`tout l’historique : ${format(k.allTime.averageOrder)}`} />
        <Kpi label="Clients payants (mois)" value={n(m.customers)} hint={`${m.newCustomers} nouveaux · ${m.customers - m.newCustomers} déjà clients`} />
        <Kpi label="Réachat" value={m.previousCustomers ? `${Math.round((m.repurchased / m.previousCustomers) * 100)} %` : '—'} hint={`${m.repurchased} des ${m.previousCustomers} clients du mois dernier ont racheté`} />
        <Kpi label="Chiffre d’affaires total" value={format(k.allTime.revenue)} hint={`${n(k.allTime.count)} ventes · ${n(k.allTime.customers)} clients · valeur d’un client ${format(k.allTime.revenuePerCustomer)}`} />
      </section>

      {(report.toHandle.pending > 0 || report.toHandle.failed > 0) && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <span>
            {report.toHandle.pending} commande{report.toHandle.pending > 1 ? 's' : ''} en attente ({format(report.toHandle.pendingFcfa)}) · {report.toHandle.failed} annulée{report.toHandle.failed > 1 ? 's' : ''} ou échouée{report.toHandle.failed > 1 ? 's' : ''} sur 30 jours.
          </span>
          <Link href="/admin/orders?status=pending" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover">Ouvrir les commandes</Link>
        </section>
      )}

      {/* Période choisie */}
      <section className="space-y-4 rounded-2xl border border-gray-200 bg-surface p-4 md:p-5">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {PRESETS.map((item) => (
            <button key={item.value} type="button" onClick={() => pick(item.value)}
              className={clsx('shrink-0 rounded-full px-3 py-1 text-sm', preset === item.value ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="text-sm"><span className="mb-1 block text-gray-600">Du</span>
            <DatePicker value={range.from} max={range.to} onChange={(v) => v && setCustom({ from: v })} />
          </div>
          <div className="text-sm"><span className="mb-1 block text-gray-600">Au</span>
            <DatePicker value={range.to} min={range.from} max={report.today} onChange={(v) => v && setCustom({ to: v })} />
          </div>
          <div className="text-sm">
            <span className="mb-1 block text-gray-600">Regrouper par</span>
            <div className="inline-flex max-w-full overflow-x-auto rounded-full bg-gray-100 p-1" role="radiogroup" aria-label="Regrouper par">
              {GROUP_LABELS.filter((g) => g.value !== 'hour' || p.days <= MAX_HOURLY_DAYS).map((g) => (
                <button key={g.value} type="button" role="radio" aria-checked={range.group === g.value} onClick={() => setRange((cur) => ({ ...cur, group: g.value }))}
                  className={clsx('shrink-0 rounded-full px-3 py-1', range.group === g.value ? 'bg-surface font-medium text-gray-900 shadow-sm' : 'text-gray-500')}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label={`${shortDate(p.from)} → ${shortDate(p.to)}`} value={format(p.revenue)} hint={`période d’avant : ${format(p.previous.revenue)}`} trend={p.growthPct} highlight />
          <Kpi label="Ventes" value={n(p.count)} hint={`avant : ${n(p.previous.count)}${p.credits ? ` · ${n(p.credits)} crédits vendus` : ''}`} />
          <Kpi label="Clients payants" value={n(p.customers)} hint={`${p.newCustomers} nouveau${p.newCustomers > 1 ? 'x' : ''}`} />
          <Kpi label="Panier moyen" value={format(p.averageOrder)} hint={`${p.days} jour${p.days > 1 ? 's' : ''}`} />
        </div>

        <RevenueChart series={p.series} group={p.group} oneDay={p.days === 1} />
      </section>

      <MarginCard margin={p.margin} from={p.from} to={p.to} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Par canal de paiement" subtitle="Part du chiffre d’affaires et évolution face à la période d’avant">
          <Shares rows={p.byMethod} />
        </Card>
        <Card title="Par offre" subtitle="Part du chiffre d’affaires et évolution face à la période d’avant">
          <Shares rows={p.byProduct} />
        </Card>
      </div>

      <Card title="Ventes de la période" subtitle={`${n(p.salesTotal)} vente${p.salesTotal > 1 ? 's' : ''} · ${TZ_LABEL}${p.salesTotal > p.sales.length ? ` · ${p.sales.length} plus récentes affichées` : ''}`}>
        {p.sales.length === 0 ? <p className="text-sm text-gray-500">Aucune vente sur cette période.</p> : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3 font-medium">{p.days > 1 ? 'Date et heure' : 'Heure'}</th>
                  <th className="py-2 pr-3 font-medium">Client</th>
                  <th className="py-2 pr-3 font-medium">Offre</th>
                  <th className="py-2 pr-3 font-medium">Canal</th>
                  <th className="py-2 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {p.sales.map((s) => (
                  <tr key={s.id} className="border-t border-gray-200">
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{saleTime(s.at, p.days > 1)}</td>
                    <td className="max-w-[180px] truncate py-2 pr-3">
                      {s.userId ? <Link href={`/admin/customers/${s.userId}`} className="hover:text-brand hover:underline">{s.name || s.email || 'Client'}</Link> : (s.name || s.email || '—')}
                    </td>
                    <td className="max-w-[200px] truncate py-2 pr-3 text-gray-600">{s.offer}{s.credits ? ` · ${n(s.credits)} cr.` : ''}</td>
                    <td className="py-2 pr-3 text-gray-600">{s.method}</td>
                    <td className="whitespace-nowrap py-2 text-right font-medium tabular-nums">{format(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AdjustmentsPanel period={p} onChange={() => void load()} />

      <ChargesPanel onSaved={() => void load()} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Par mois" subtitle="12 derniers mois">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3 font-medium">Mois</th><th className="py-2 pr-3 text-right font-medium">Chiffre d’affaires</th>
                  <th className="py-2 pr-3 text-right font-medium">Évolution</th><th className="py-2 text-right font-medium">Ventes</th>
                </tr>
              </thead>
              <tbody>
                {[...report.monthly].reverse().map((row, i, rows) => {
                  const before = rows[i + 1]
                  const g = before && before.revenue > 0 ? ((row.revenue - before.revenue) / before.revenue) * 100 : null
                  return (
                    <tr key={row.month} className={clsx('border-t border-gray-200', row.month === m.key && 'bg-gray-50')}>
                      <td className="py-2 pr-3 capitalize">{monthLabel(row.month)}{row.month === m.key ? ' (en cours)' : ''}</td>
                      <td className="py-2 pr-3 text-right font-medium tabular-nums">{format(row.revenue)}</td>
                      <td className="py-2 pr-3 text-right"><Growth value={g} /></td>
                      <td className="py-2 text-right tabular-nums text-gray-600">{n(row.count)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Meilleurs clients" subtitle="Période choisie">
          {p.top.length === 0 ? <p className="text-sm text-gray-500">Aucune vente.</p> : (
            <ol className="divide-y divide-gray-200">
              {p.top.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-xs text-gray-400">{i + 1}</span>
                    {c.userId ? <Link href={`/admin/customers/${c.userId}`} className="min-w-0 truncate hover:text-brand hover:underline">{c.name || c.email || 'Client'}</Link> : <span className="min-w-0 truncate">{c.name || c.email || 'Client'}</span>}
                  </span>
                  <span className="shrink-0 text-right"><span className="font-medium">{format(c.revenue)}</span><span className="ml-2 text-xs text-gray-500">{c.count} achat{c.count > 1 ? 's' : ''}</span></span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </main>
  )
}

const trend = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : now > 0 ? 100 : 0)

function Shares({ rows }: { rows: Slice[] }) {
  const { format } = useAdminCurrency()
  if (rows.length === 0) return <p className="text-sm text-gray-500">Aucune vente.</p>
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{r.label}</span>
            <span className="shrink-0 text-right">
              <span className="font-medium tabular-nums">{format(r.revenue)}</span>
              <span className="ml-2 text-xs text-gray-500">{r.count} · {Math.round(r.sharePct)} %</span>
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(1.5, r.sharePct)}%` }} />
            </div>
            <span className="w-28 shrink-0 text-right">{r.previous > 0 ? <Growth value={r.growthPct} /> : <span className="text-xs text-gray-400">nouveau</span>}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
