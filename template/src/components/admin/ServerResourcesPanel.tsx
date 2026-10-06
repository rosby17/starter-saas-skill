'use client'

import { useCallback, useEffect, useState } from 'react'

type Sample = { collected_at: string; cpu_percent: number | null; memory_percent: number | null; disk_percent: number | null }
type Data = {
  metrics: { hostname: string; cpu: { usagePercent: number | null; cores: number; load1: number | null }; memory: { usedPercent: number | null }; disk: { usedPercent: number | null } }
  history: { samples: Sample[]; unavailable: boolean }
  agentError: string | null
  agentConfigured: boolean
}

// Un pic d'une minute (un déploiement qui construit l'image) n'est PAS une alerte : l'état se juge sur la
// moyenne des 5 dernières mesures, pas sur la dernière seule.
const level = (value: number | null, warning: number, critical: number) =>
  value === null ? 'unknown' : value >= critical ? 'critical' : value >= warning ? 'warning' : 'ok'
const TONE: Record<string, string> = { ok: 'text-green-700 bg-green-50', warning: 'text-amber-700 bg-amber-50', critical: 'text-red-700 bg-red-50', unknown: 'text-gray-500 bg-gray-100' }
const LABEL: Record<string, string> = { ok: 'Tout va bien', warning: 'À surveiller', critical: 'Critique', unknown: 'Inconnu' }

const average = (values: (number | null)[]) => {
  const list = values.filter((v): v is number => v !== null)
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null
}

function Sparkline({ values }: { values: (number | null)[] }) {
  const points = values.map((v, i) => (v === null ? null : `${(i / Math.max(1, values.length - 1)) * 300},${60 - (Math.min(100, v) / 100) * 60}`)).filter(Boolean)
  if (points.length < 2) return <p className="text-xs text-gray-400">Les courbes se remplissent, une mesure par minute.</p>
  return <svg viewBox="0 0 300 60" className="h-16 w-full" preserveAspectRatio="none"><polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
}

export function ServerResourcesPanel() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/server-resources', { cache: 'no-store' })
      const json = await res.json()
      if (!json.success) throw new Error(json.message || 'Chargement impossible')
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const timer = setInterval(load, 15_000)
    return () => clearInterval(timer)
  }, [load])

  if (error) return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
  if (!data) return <p className="text-sm text-gray-500">Chargement…</p>

  const recent = data.history.samples.slice(-5)
  const cards = [
    { name: 'Processeur', now: data.metrics.cpu.usagePercent, avg: average(recent.map((s) => s.cpu_percent)), series: data.history.samples.map((s) => s.cpu_percent), warning: 75, critical: 90 },
    { name: 'Mémoire', now: data.metrics.memory.usedPercent, avg: average(recent.map((s) => s.memory_percent)), series: data.history.samples.map((s) => s.memory_percent), warning: 80, critical: 90 },
    { name: 'Disque', now: data.metrics.disk.usedPercent, avg: average(recent.map((s) => s.disk_percent)), series: data.history.samples.map((s) => s.disk_percent), warning: 80, critical: 90 },
  ]
  const worst = cards.map((c) => level(c.avg ?? c.now, c.warning, c.critical)).sort((a, b) => ['critical', 'warning', 'ok', 'unknown'].indexOf(a) - ['critical', 'warning', 'ok', 'unknown'].indexOf(b))[0]

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl px-5 py-4 ${TONE[worst]}`}>
        <p className="text-lg font-bold">{LABEL[worst]}</p>
        <p className="text-sm opacity-80">{data.metrics.hostname} · {data.metrics.cpu.cores} cœurs · état jugé sur la moyenne des 5 dernières minutes</p>
      </div>
      {!data.agentConfigured && <p className="text-sm text-gray-500">Mesures du conteneur seulement. Pour celles du serveur entier, installer ops/vps-metrics-agent.py et renseigner SERVER_METRICS_URL.</p>}
      {data.agentError && <p className="text-sm text-amber-700">Collecteur du serveur injoignable ({data.agentError}) : mesures du conteneur affichées.</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.name} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-gray-500">{c.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE[level(c.avg ?? c.now, c.warning, c.critical)]}`}>{LABEL[level(c.avg ?? c.now, c.warning, c.critical)]}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.now === null ? '—' : `${c.now.toFixed(1)} %`}</p>
            <div className="text-brand"><Sparkline values={c.series} /></div>
          </div>
        ))}
      </div>
      {data.history.unavailable && <p className="text-sm text-gray-500">Historique indisponible : appliquer la migration 0013_server_resource_samples.sql.</p>}
    </div>
  )
}
