'use client'

import { useMemo, useState } from 'react'
import { clsx } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import { formatFcfa } from '@/lib/catalog/types'
import { TZ_OFFSET_MS } from '@/lib/time'

// Un événement par jour : vente (montant FCFA), visite d'une fiche, ou réservation (précommande).
export type StatEvent = { d: string; p: string | null; k: 'sale' | 'view' | 'resa'; v: number }

const PERIODS = [
  { value: '7', label: '7 jours' }, { value: '28', label: '28 jours' }, { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' }, { value: '365', label: '12 mois' }, { value: 'all', label: 'Tout' },
] as const
const METRICS = [
  { value: 'revenue', label: 'Revenus', unit: (n: number) => formatFcfa(n) },
  { value: 'sales', label: 'Ventes', unit: (n: number) => `${n} vente${n > 1 ? 's' : ''}` },
  { value: 'views', label: 'Visiteurs', unit: (n: number) => `${n} visite${n > 1 ? 's' : ''}` },
  { value: 'resa', label: 'Réservations', unit: (n: number) => `${n} réservation${n > 1 ? 's' : ''}` },
] as const
type Metric = (typeof METRICS)[number]['value']

const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const valueOf = (e: StatEvent, m: Metric) =>
  m === 'revenue' ? (e.k === 'sale' || e.k === 'resa' ? e.v : 0) : m === 'sales' ? (e.k === 'sale' ? 1 : 0) : m === 'views' ? (e.k === 'view' ? e.v : 0) : e.k === 'resa' ? 1 : 0

/** Graphique unique des statistiques : période, mesure et offre se choisissent au-dessus de la courbe. */
export function StatsChart({ events, products }: { events: StatEvent[]; products: { id: string; title: string }[] }) {
  const [period, setPeriod] = useState<string>('30')
  const [metric, setMetric] = useState<Metric>('revenue')
  const [product, setProduct] = useState('')

  const { points, total, previous, monthly } = useMemo(() => {
    const today = Date.now() + TZ_OFFSET_MS // heure locale de la plateforme
    const first = events.reduce((a, e) => (e.d < a ? e.d : a), iso(today))
    const days = period === 'all' ? Math.max(30, Math.ceil((today - new Date(first).getTime()) / 86_400_000) + 1) : Number(period)
    const start = iso(today - (days - 1) * 86_400_000)
    const prevStart = iso(today - (2 * days - 1) * 86_400_000)
    const mine = events.filter((e) => !product || e.p === product)
    const sum = (from: string, to: string) => mine.filter((e) => e.d >= from && e.d <= to).reduce((t, e) => t + valueOf(e, metric), 0)
    const byMonth = days > 92
    const buckets: { key: string; label: string; value: number }[] = []
    if (byMonth) {
      const s = new Date(`${start.slice(0, 7)}-01T12:00:00Z`), end = new Date(today)
      for (const d = s; d <= end; d.setUTCMonth(d.getUTCMonth() + 1))
        buckets.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), value: 0 })
    } else {
      for (let i = 0; i < days; i++) {
        const k = iso(today - (days - 1 - i) * 86_400_000)
        buckets.push({ key: k, label: new Date(`${k}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), value: 0 })
      }
    }
    const index = new Map(buckets.map((b, i) => [b.key, i]))
    for (const e of mine) {
      if (e.d < start) continue
      const i = index.get(byMonth ? e.d.slice(0, 7) : e.d)
      if (i !== undefined) buckets[i].value += valueOf(e, metric)
    }
    const prevEnd = iso(new Date(start).getTime() - 86_400_000)
    return { points: buckets, total: sum(start, iso(today)), previous: period === 'all' ? null : sum(prevStart, prevEnd), monthly: byMonth }
  }, [events, period, metric, product])

  const fmt = METRICS.find((m) => m.value === metric)!.unit
  const change = previous ? Math.round(((total - previous) / previous) * 100) : null
  const W = 960, H = 280, L = 64, R = 16, T = 16, B = 34
  const max = Math.max(1, ...points.map((p) => p.value))
  const step = (W - L - R) / Math.max(1, points.length - 1)
  const x = (i: number) => L + i * step
  const y = (v: number) => T + (H - T - B) * (1 - v / max)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - B} L${L},${H - B} Z`
  const every = Math.ceil(points.length / 10)
  const tick = (v: number) => (metric === 'revenue' && v >= 1000 ? `${Math.round(v / 1000)} k` : String(Math.round(v)))

  return (
    <section className="space-y-4 rounded-3xl border border-gray-200 bg-surface p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-full bg-gray-100 p-1" role="tablist" aria-label="Mesure">
          {METRICS.map((m) => (
            <button key={m.value} type="button" role="tab" aria-selected={metric === m.value} onClick={() => setMetric(m.value)}
              className={clsx('rounded-full px-4 py-1.5 text-sm', metric === m.value ? 'bg-surface font-medium shadow-sm' : 'text-gray-600 hover:text-gray-900')}>{m.label}</button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <div className="w-56"><Select value={product} onChange={setProduct} options={[{ value: '', label: 'Toutes les offres' }, ...products.map((p) => ({ value: p.id, label: p.title }))]} /></div>
          <div className="w-36"><Select value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} /></div>
        </div>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4">
        <p className="text-3xl font-medium tracking-tight">{fmt(total)}</p>
        {change !== null && (
          <p className={clsx('text-sm', change >= 0 ? 'text-green-700' : 'text-red-700')}>{change >= 0 ? '+' : ''}{change} % par rapport à la période précédente</p>
        )}
        {previous === 0 && total > 0 && <p className="text-sm text-green-700">Nouveau sur cette période</p>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full text-brand" role="img" aria-label="Évolution">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} className="stroke-gray-200" strokeDasharray="3 4" />
            <text x={L - 8} y={y(max * t) + 4} textAnchor="end" className="fill-gray-500 text-[11px]">{tick(max * t)}</text>
          </g>
        ))}
        <path d={area} fill="currentColor" opacity="0.12" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => p.value > 0 && (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={points.length > 60 ? 2.5 : 3.5} fill="currentColor"><title>{`${p.label} : ${fmt(p.value)}`}</title></circle>
        ))}
        {points.map((p, i) => (i % every === 0 || i === points.length - 1) && (
          <text key={`l${i}`} x={x(i)} y={H - 12} textAnchor="middle" className="fill-gray-500 text-[11px]">{p.label}</text>
        ))}
      </svg>
      <p className="text-xs text-gray-500">
        {monthly ? 'Un point par mois.' : 'Un point par jour.'} Revenus : argent encaissé (achats, soldes et réservations), hors tests. Visiteurs : ouvertures des fiches des offres. Survole un point pour son détail.
      </p>
    </section>
  )
}
