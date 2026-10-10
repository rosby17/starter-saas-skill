import Link from 'next/link'
import type { Metadata } from 'next'
import { serviceClient } from '@/lib/auth/service-client'
import { formatFcfa } from '@/lib/catalog/types'
import { clsx } from '@/lib/utils'
import { StatsChart, type StatEvent } from './StatsChart'
import { localDay } from '@/lib/time'

export const metadata: Metadata = { title: 'Statistiques' }
export const dynamic = 'force-dynamic'

type Row = {
  id: string; slug: string; title: string; category: string; preorder: boolean
  views30: number; views: number; sales: number; revenue: number; owners: number; reservations: number
  lessons: number; started: number; completed: number; avgProgress: number; hours: number
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)

// Statistiques des formations et des offres : ce qui intéresse (visites), ce qui se vend (ventes, chiffre d'affaires),
// ce qui est suivi (élèves qui commencent, qui finissent, temps passé) et où les élèves décrochent.
// Les commandes de test ne comptent jamais. Lecture côté serveur (page réservée aux admins par le layout).
export default async function StatsPage({ searchParams }: { searchParams: Promise<{ cours?: string }> }) {
  const { cours } = await searchParams
  const db = serviceClient()
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const [{ data: products }, { data: views }, { data: orders }, { data: ents }, { data: pre }, { data: lessons }, { data: progress }, { data: activity }] = await Promise.all([
    db.from('products').select('id, slug, title, category, preorder, published').order('position'),
    db.from('product_views').select('product_id, day, views'),
    db.from('orders').select('product_id, amount_fcfa, paid_amount_fcfa, created_at, paid_at, purchase_kind').eq('status', 'success').eq('is_test', false),
    db.from('entitlements').select('user_id, product_id').is('revoked_at', null).is('expires_at', null),
    db.from('preorders').select('product_id').eq('status', 'reserved'),
    db.from('lessons').select('id, product_id, title, position, section').order('position'),
    db.from('lesson_progress').select('user_id, lesson_id'),
    db.from('lesson_activity').select('user_id, lesson_id, product_id, seconds'),
  ])

  const lessonsBy = new Map<string, { id: string; title: string; section: string | null }[]>()
  for (const l of lessons ?? []) lessonsBy.set(l.product_id, [...(lessonsBy.get(l.product_id) ?? []), l])
  const lessonProduct = new Map((lessons ?? []).map((l) => [l.id, l.product_id]))
  const doneBy = new Map<string, Map<string, number>>() // produit → élève → leçons terminées
  for (const p of progress ?? []) {
    const pid = lessonProduct.get(p.lesson_id)
    if (!pid) continue
    const m = doneBy.get(pid) ?? new Map<string, number>()
    m.set(p.user_id, (m.get(p.user_id) ?? 0) + 1)
    doneBy.set(pid, m)
  }

  const rows: Row[] = (products ?? []).filter((p) => p.published || (orders ?? []).some((o) => o.product_id === p.id)).map((p) => {
    const v = (views ?? []).filter((x) => x.product_id === p.id)
    const sold = (orders ?? []).filter((o) => o.product_id === p.id)
    const owners = new Set((ents ?? []).filter((e) => e.product_id === p.id).map((e) => e.user_id))
    const ls = lessonsBy.get(p.id) ?? []
    const done = doneBy.get(p.id) ?? new Map<string, number>()
    const act = (activity ?? []).filter((a) => a.product_id === p.id)
    const started = new Set([...done.keys(), ...act.map((a) => a.user_id)])
    const completed = [...done.values()].filter((n) => ls.length && n >= ls.length).length
    const avg = owners.size && ls.length ? Math.round([...owners].reduce((s, u) => s + Math.min(1, (done.get(u) ?? 0) / ls.length), 0) / owners.size * 100) : 0
    return {
      id: p.id, slug: p.slug, title: p.title, category: p.category, preorder: p.preorder,
      views30: v.filter((x) => x.day >= since30).reduce((s, x) => s + x.views, 0),
      views: v.reduce((s, x) => s + x.views, 0),
      sales: sold.length,
      revenue: sold.reduce((s, o) => s + Number(o.paid_amount_fcfa ?? o.amount_fcfa ?? 0), 0),
      owners: owners.size,
      reservations: (pre ?? []).filter((x) => x.product_id === p.id).length,
      lessons: ls.length, started: started.size, completed, avgProgress: avg,
      hours: Math.round(act.reduce((s, a) => s + a.seconds, 0) / 360) / 10,
    }
  }).sort((a, b) => b.revenue - a.revenue || b.views - a.views)

  // Événements du graphique (jour, offre, type, valeur) : ventes et réservations encaissées, visites des fiches. Heure locale de la plateforme.
  const day = (iso: string) => localDay(iso)
  const events: StatEvent[] = [
    ...(orders ?? []).map((o) => ({ d: day(o.paid_at || o.created_at), p: o.product_id, k: (o.purchase_kind === 'deposit' ? 'resa' : 'sale') as StatEvent['k'], v: Number(o.paid_amount_fcfa ?? o.amount_fcfa ?? 0) })),
    ...(views ?? []).map((v) => ({ d: String(v.day), p: v.product_id, k: 'view' as const, v: v.views })),
  ]

  const total = { revenue: rows.reduce((s, r) => s + r.revenue, 0), sales: rows.reduce((s, r) => s + r.sales, 0), views30: rows.reduce((s, r) => s + r.views30, 0), reservations: rows.reduce((s, r) => s + r.reservations, 0) }
  const courses = rows.filter((r) => r.lessons > 0)
  const selected = courses.find((c) => c.slug === cours) ?? courses[0]

  // Entonnoir du cours choisi : pour chaque leçon, combien l'ont ouverte et combien l'ont terminée.
  const funnel = selected ? (lessonsBy.get(selected.id) ?? []).map((l, i) => {
    const opened = new Set([...(activity ?? []).filter((a) => a.lesson_id === l.id).map((a) => a.user_id), ...(progress ?? []).filter((p) => p.lesson_id === l.id).map((p) => p.user_id)]).size
    const finished = (progress ?? []).filter((p) => p.lesson_id === l.id).length
    const minutes = Math.round((activity ?? []).filter((a) => a.lesson_id === l.id).reduce((s, a) => s + a.seconds, 0) / 60)
    return { n: i + 1, title: l.title, section: l.section, opened, finished, minutes }
  }) : []
  const maxOpened = Math.max(1, ...funnel.map((f) => f.opened))

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="text-3xl md:text-4xl">Statistiques</h1>
        <p className="mt-1 text-sm text-gray-500">Ce qui intéresse, ce qui se vend, ce qui est suivi jusqu’au bout. Les commandes de test ne comptent pas.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        {[['Chiffre d’affaires', formatFcfa(total.revenue)], ['Ventes', String(total.sales)], ['Visites des fiches (30 j)', String(total.views30)], ['Réservations en attente', String(total.reservations)]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-gray-200 bg-surface p-5">
            <p className="text-sm text-gray-500">{l}</p>
            <p className="mt-1 text-2xl font-medium tracking-tight">{v}</p>
          </div>
        ))}
      </section>

      <StatsChart events={events} products={rows.map((r) => ({ id: r.id, title: r.title }))} />

      <section className="overflow-x-auto rounded-2xl border border-gray-200 bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-5 py-3 font-medium">Offre</th><th className="px-3 py-3 font-medium">Visites 30 j</th><th className="px-3 py-3 font-medium">Ventes</th>
            <th className="px-3 py-3 font-medium">Conversion</th><th className="px-3 py-3 font-medium">Chiffre d’affaires</th><th className="px-3 py-3 font-medium">Élèves</th>
            <th className="px-3 py-3 font-medium">Ont commencé</th><th className="px-3 py-3 font-medium">Ont fini</th><th className="px-3 py-3 font-medium">Temps passé</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-200 last:border-0">
                <td className="px-5 py-3.5">
                  <span className="font-medium">{r.title}</span>
                  <span className="block text-xs text-gray-500">{r.category}{r.preorder ? ` · précommande · ${r.reservations} réservation${r.reservations > 1 ? 's' : ''}` : ''}</span>
                </td>
                <td className="px-3">{r.views30}<span className="text-xs text-gray-500"> / {r.views}</span></td>
                <td className="px-3">{r.sales}</td>
                <td className="px-3">{r.views ? `${pct(r.sales, r.views)} %` : '—'}</td>
                <td className="px-3 font-medium">{r.revenue ? formatFcfa(r.revenue) : '—'}</td>
                <td className="px-3">{r.owners}</td>
                <td className="px-3">{r.lessons ? `${r.started} (${pct(r.started, r.owners)} %)` : '—'}</td>
                <td className="px-3">{r.lessons ? `${r.completed} (${pct(r.completed, r.owners)} %)` : '—'}</td>
                <td className="px-3">{r.lessons ? `${r.hours} h` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selected && (
        <section className="space-y-4 rounded-3xl border border-gray-200 bg-surface p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl">Où les élèves décrochent</h2>
            <div className="ml-auto flex flex-wrap gap-1 rounded-full bg-gray-100 p-1">
              {courses.map((c) => (
                <Link key={c.id} href={`/admin/statistiques?cours=${c.slug}`} className={clsx('rounded-full px-3 py-1.5 text-sm', c.id === selected.id ? 'bg-surface font-medium shadow-sm' : 'text-gray-600 hover:text-gray-900')}>{c.title}</Link>
              ))}
            </div>
          </div>
          <p className="text-sm text-gray-500">{selected.owners} élève{selected.owners > 1 ? 's' : ''} · progression moyenne {selected.avgProgress} % · {selected.hours} h passées dans le cours.</p>
          <ol className="space-y-2">
            {funnel.map((f) => (
              <li key={f.n} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="text-gray-500 tabular-nums">{f.n}</span>
                <div className="min-w-0">
                  <p className="truncate">{f.title}</p>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-brand/30" style={{ width: `${(f.opened / maxOpened) * 100}%` }}>
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct(f.finished, f.opened)}%` }} />
                    </div>
                  </div>
                </div>
                <span className="text-right text-xs text-gray-500 tabular-nums">{f.opened} ouverte{f.opened > 1 ? 's' : ''} · {f.finished} finie{f.finished > 1 ? 's' : ''} · {f.minutes} min</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-gray-500">Barre claire : élèves qui ont ouvert la leçon. Barre foncée : ceux qui l’ont terminée. Une forte baisse d’une leçon à l’autre montre où le cours perd ses élèves.</p>
        </section>
      )}
    </main>
  )
}
