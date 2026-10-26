'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/choice'
import { Skeleton } from '@/components/ui/skeleton'
import { clsx } from '@/lib/utils'
import { actionLabel, SOURCE_LABELS, STATUS_LABELS, type FeedDetail, type FeedItem, type FeedStatus, type FeedSummary, type FeedUser } from '@/lib/activity/types'

// Fil d'activité en direct : chaque action du site (inscription, commande, demande…), réussie ou non, qui
// l'a faite et d'où. Rafraîchi toutes les 20 s (pause possible) ; les nouvelles lignes sont surlignées.
// Une action longue a ses étapes dépliables ; « Lire » ouvre son texte complet et son diagnostic.

const REFRESH_MS = 20_000
const PAGE = 100

type Filters = { periode: string; status: string; source: string; action: string }
const EMPTY: Filters = { periode: 'jour', status: '', source: '', action: '' }

type Response = { success: true; generatedAt: string; matching: number; truncated: boolean; items: FeedItem[]; users: Record<string, FeedUser>; summary: FeedSummary } | { success: false; message: string }

const TONE: Record<FeedStatus, 'green' | 'red' | 'amber' | 'gray'> = { succeeded: 'green', failed: 'red', stuck: 'red', running: 'amber', cancelled: 'gray' }

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const dayTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const money = (amount: number, currency: string | null) => `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} ${currency === 'XOF' || !currency ? 'FCFA' : currency}`
function duration(ms: number | null) {
  if (ms === null) return null
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`
  return `${Math.round(ms / 60_000)} min`
}

export function ActivityFeed() {
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [limit, setLimit] = useState(PAGE)
  const [data, setData] = useState<Extract<Response, { success: true }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set())
  const [reading, setReading] = useState<FeedItem | null>(null)
  // Lignes de la lecture précédente (mêmes filtres) : les nouvelles sont surlignées un instant.
  const seen = useRef<{ key: string; ids: Set<string> } | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(limit) })
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v)
    try {
      const res = await fetch(`/api/admin/activity?${params}`, { cache: 'no-store' })
      const json = (await res.json()) as Response
      if (!json.success) return setError(json.message)
      setError(null)
      const key = JSON.stringify(filters)
      const before = seen.current?.key === key ? seen.current.ids : null
      if (before) setFresh(new Set(json.items.filter((i) => !before.has(i.id)).map((i) => i.id)))
      else setFresh(new Set())
      seen.current = { key, ids: new Set(json.items.map((i) => i.id)) }
      setData(json)
    } catch {
      setError('Fil illisible : vérifiez la connexion.')
    } finally {
      setLoading(false)
    }
  }, [filters, limit])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!live) return
    const timer = setInterval(() => { void load() }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [live, load])

  const setFilter = (patch: Partial<Filters>) => { setLoading(true); setLimit(PAGE); setFilters((f) => ({ ...f, ...patch })) }
  const toggleSteps = (id: string) => setOpenSteps((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const summary = data?.summary
  const revenue = summary ? Object.entries(summary.revenue) : []
  const actionOptions = [{ value: '', label: 'Toutes les actions' }, ...(summary?.byAction ?? []).map((a) => ({ value: a.action, label: `${a.label} (${a.count})` }))]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Switch checked={live} onChange={setLive} label={live ? 'En direct' : 'En pause'} />
        <Button type="button" variant="secondary" onClick={() => { setLoading(true); void load() }} disabled={loading}>{loading ? 'Lecture…' : 'Actualiser'}</Button>
        {data && <span className="text-xs text-gray-500">Mis à jour à {time(data.generatedAt)}</span>}
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {!data && !error && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>}

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="Actions" value={String(summary.total)} onClick={() => setFilter({ status: '' })} />
          <Kpi label="Réussite" value={summary.successRate === null ? '—' : `${Math.round(summary.successRate * 100)} %`} tone={summary.successRate !== null && summary.successRate < 0.8 ? 'text-red-700' : 'text-green-700'} />
          <Kpi label="Échecs et blocages" value={String(summary.byStatus.failed + summary.byStatus.stuck)} tone={summary.byStatus.failed + summary.byStatus.stuck ? 'text-red-700' : undefined} onClick={() => setFilter({ status: 'problemes' })} />
          <Kpi label="Clients actifs" value={String(summary.activeUsers)} />
          <Kpi label="Encaissé" value={revenue.length ? revenue.map(([c, v]) => money(v, c)).join(' · ') : '0'} onClick={() => setFilter({ action: 'commande', status: 'succeeded' })} />
        </div>
      )}

      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={filters.periode} onChange={(v) => setFilter({ periode: v })} options={[{ value: 'jour', label: "Aujourd'hui" }, { value: 'hier', label: "Depuis hier" }, { value: 'semaine', label: '7 derniers jours' }]} />
          <Select value={filters.status} onChange={(v) => setFilter({ status: v })} options={[{ value: '', label: 'Tous les statuts' }, { value: 'problemes', label: 'Échecs et blocages' }, ...(Object.keys(STATUS_LABELS) as FeedStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))]} />
          <Select value={filters.source} onChange={(v) => setFilter({ source: v })} options={[{ value: '', label: 'Toutes les sources' }, ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }))]} />
          <Select value={filters.action} onChange={(v) => setFilter({ action: v })} options={actionOptions} />
        </div>
        {(filters.status || filters.source || filters.action || filters.periode !== 'jour') && (
          <button type="button" onClick={() => setFilter(EMPTY)} className="mt-3 text-sm text-gray-600 underline">Retirer les filtres</button>
        )}
      </Card>

      {data && (
        <section aria-label="Actions" className="space-y-2">
          <p className="text-sm text-gray-500">{data.matching} action{data.matching > 1 ? 's' : ''}{data.truncated ? ' (période très chargée : seules les plus récentes sont lues)' : ''}</p>
          {data.items.length === 0 && <EmptyState title="Rien pour l'instant" text="Les inscriptions, commandes et demandes apparaîtront ici dès qu'elles arrivent." />}
          <ul className="space-y-2">
            {data.items.map((item) => (
              <li key={item.id}>
                <Row item={item} user={item.userId ? data.users[item.userId] : undefined} fresh={fresh.has(item.id)} long={filters.periode !== 'jour'}
                  stepsOpen={openSteps.has(item.id)} onToggleSteps={() => toggleSteps(item.id)} onRead={() => setReading(item)} />
                {item.steps.length > 0 && openSteps.has(item.id) && (
                  <ul className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-3 sm:ml-8">
                    {item.steps.map((step) => (
                      <li key={step.id}><Row item={step} user={step.userId ? data.users[step.userId] : undefined} fresh={false} long={filters.periode !== 'jour'} compact onRead={() => setReading(step)} /></li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {data.matching > data.items.length && (
            <Button type="button" variant="secondary" onClick={() => { setLoading(true); setLimit((l) => l + PAGE) }} disabled={loading}>Afficher plus</Button>
          )}
        </section>
      )}

      <DetailModal item={reading} user={reading?.userId ? data?.users[reading.userId] : undefined} onClose={() => setReading(null)} />
    </div>
  )
}

function Kpi({ label, value, tone, onClick }: { label: string; value: string; tone?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="block text-xs uppercase tracking-wide text-gray-500">{label}</span>
      <span className={clsx('mt-1 block break-words text-xl font-bold sm:text-2xl', tone)}>{value}</span>
    </>
  )
  return onClick
    ? <button type="button" onClick={onClick} className="rounded-2xl border border-gray-200 bg-surface p-4 text-left transition-colors hover:border-gray-300">{body}</button>
    : <div className="rounded-2xl border border-gray-200 bg-surface p-4">{body}</div>
}

function Row({ item, user, fresh, long, compact, stepsOpen, onToggleSteps, onRead }: {
  item: FeedItem; user?: FeedUser; fresh: boolean; long: boolean; compact?: boolean; stepsOpen?: boolean; onToggleSteps?: () => void; onRead: () => void
}) {
  const who = user?.name || user?.email || (item.userId ? 'Client' : 'Visiteur')
  return (
    <div className={clsx('rounded-xl border bg-surface transition-colors', compact ? 'p-2.5' : 'p-3 sm:p-4', fresh ? 'border-brand' : 'border-gray-200')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-16 shrink-0 text-xs tabular-nums text-gray-500">{long ? dayTime(item.createdAt) : time(item.createdAt)}</span>
        <Badge tone={TONE[item.status]}>{STATUS_LABELS[item.status]}</Badge>
        <span className={clsx('min-w-0 flex-1 basis-48 font-medium', compact && 'text-sm')}>{item.label}</span>
        {item.amount !== null && item.amount > 0 && <span className="text-sm font-semibold tabular-nums">{money(item.amount, item.currency)}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 sm:pl-[4.75rem]">
        {item.userId ? <Link href={`/admin/customers/${item.userId}`} className="max-w-full truncate underline-offset-2 hover:underline">{who}</Link> : <span>{who}</span>}
        <span className="rounded-full border border-gray-200 px-2 py-0.5">{SOURCE_LABELS[item.source]}</span>
        <span>{actionLabel(item.action)}</span>
        {duration(item.durationMs) && <span>{duration(item.durationMs)}</span>}
        {item.test && <span className="text-amber-700">test</span>}
        {item.steps.length > 0 && onToggleSteps && (
          <button type="button" onClick={onToggleSteps} aria-expanded={stepsOpen} className="font-medium text-gray-700 underline">
            {stepsOpen ? 'Replier' : `${item.steps.length} étape${item.steps.length > 1 ? 's' : ''}`}
          </button>
        )}
        {(item.hasDetail || item.error) && <button type="button" onClick={onRead} className="font-medium text-gray-700 underline">Lire</button>}
      </div>
      {item.error && <p className="mt-1.5 break-words text-xs text-red-700 sm:pl-[4.75rem]">{item.error}</p>}
      {!item.error && item.preview && <p className="mt-1.5 line-clamp-1 break-words text-xs text-gray-600 sm:pl-[4.75rem]">{item.preview}</p>}
    </div>
  )
}

function DetailModal({ item, user, onClose }: { item: FeedItem | null; user?: FeedUser; onClose: () => void }) {
  const [detail, setDetail] = useState<FeedDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const id = item?.id

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetch(`/api/admin/activity/item?id=${id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => { if (!cancelled) { if (json.success) { setDetail(json.detail); setError(null) } else setError(json.message) } })
      .catch(() => { if (!cancelled) setError('Lecture impossible : vérifiez la connexion.') })
    return () => { cancelled = true; setDetail(null); setError(null) }
  }, [id])

  const meta = Object.entries(detail?.metadata ?? {}).filter(([, v]) => v !== null && v !== '' && v !== false)
  return (
    <Modal className="max-w-2xl" open={Boolean(item)} onClose={onClose} title={item?.label ?? ''} subtitle={item ? `${dayTime(item.createdAt)} · ${user?.name || user?.email || 'Visiteur'} · ${SOURCE_LABELS[item.source]}` : undefined}
      footer={detail?.href ? <Link href={detail.href} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">Ouvrir la fiche</Link> : undefined}>
      {!detail && !error && <Skeleton className="h-32" />}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {detail && (
        <div className="space-y-4 text-sm">
          {detail.error && <p className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{detail.error}</p>}
          {detail.detail && <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-gray-50 p-3 font-sans text-gray-800">{detail.detail}</pre>}
          {meta.length > 0 && (
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
              {meta.map(([k, v]) => (<Fragment key={k}><dt className="text-gray-500">{k}</dt><dd className="break-words">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></Fragment>))}
            </dl>
          )}
          {!detail.detail && !detail.error && meta.length === 0 && <p className="text-gray-500">Pas de détail pour cette action.</p>}
        </div>
      )}
    </Modal>
  )
}
