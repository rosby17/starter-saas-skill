'use client'

import { useCallback, useEffect, useState } from 'react'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/choice'
import { useConfirm } from '@/components/ui/dialog'
import { clsx } from '@/lib/utils'

// Administration › Moteurs IA : une seule structure pour tous les services, service → modèles → moteurs.
// Les moteurs n'apparaissent que sous leur nom de code (src/lib/engines/codenames.ts).

type EngineState = 'ready' | 'missing_keys' | 'set_aside'
type Engine = { id: string; codename: string; cost: string | null; accounts: number; state: EngineState; setAsideReason: string | null; hasProbe: boolean }
type Model = { id: string; label: string; engines: string[]; active: string; servedBy: string | null; fallback: boolean }
type Service = {
  id: string
  label: string
  watched: boolean
  outage: { since: string; auto: boolean; trigger?: string } | null
  watch: { down: boolean; failures: number; lastProbeAt: number | null } | null
  models: Model[]
}
type Snapshot = { engines: Engine[]; services: Service[]; autoFallback: boolean; watchdog: { enabled: boolean; envOff: boolean } }

const STATE_LABEL: Record<EngineState, string> = { ready: 'Prêt', missing_keys: 'Clés manquantes', set_aside: 'À sec ou refusé' }
const STATE_TONE: Record<EngineState, string> = {
  ready: 'border-green-200 bg-green-50 text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300',
  missing_keys: 'border-gray-200 bg-gray-50 text-gray-600',
  set_aside: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
}

const when = (value: string | number) => new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function AdminEnginesPage() {
  const confirm = useConfirm()
  const [data, setData] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/engines', { cache: 'no-store' })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Impossible de charger l’état des moteurs.')
    }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [load])

  const send = async (key: string, body: Record<string, unknown>) => {
    setBusy(key)
    setError(null)
    try {
      const res = await fetch('/api/admin/engines', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      setData(json)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Enregistrement impossible.')
    } finally {
      setBusy(null)
    }
  }

  const engineById = (id: string) => data?.engines.find((e) => e.id === id)

  const togglePause = async (service: Service) => {
    if (service.outage) return send(`svc:${service.id}`, { reopen: service.id })
    const ok = await confirm({
      title: `Mettre « ${service.label} » en pause ?`,
      message: 'Seul ce service est fermé dans l’espace client, avec un bandeau clair. Le site, l’API et les autres services restent ouverts. La sonde ne lèvera pas une pause posée à la main.',
      confirmLabel: 'Mettre en pause',
      danger: true,
    })
    if (ok) await send(`svc:${service.id}`, { pause: service.id })
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Supervision</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">Moteurs IA</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-500">Chaque service propose des modèles ; chaque modèle est servi par un moteur actif, choisi ici. Un client n’est jamais envoyé vers un moteur à sec : le modèle est grisé tant qu’aucun moteur ne peut le servir.</p>
      </header>

      {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {!data ? (
        !error && <p className="py-16 text-center text-gray-400">Chargement…</p>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2">
            <div className={clsx('rounded-3xl border p-5', data.autoFallback ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10' : 'border-gray-200 bg-surface')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900">Bascule automatique {data.autoFallback ? 'activée' : 'coupée'}</h2>
                  <p className="mt-1 text-sm text-gray-500">{data.autoFallback
                    ? 'Si le moteur actif d’un modèle est à sec ou refuse, un autre moteur du même modèle prend le relais sans prévenir.'
                    : 'Réglage conseillé. Si le moteur actif tombe, le modèle est grisé pour les clients au lieu de changer de rendu sans votre accord.'}</p>
                </div>
                <Switch checked={data.autoFallback} onChange={(v) => busy === null && send('fallback', { autoFallback: v })} />
              </div>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-gray-900">Sonde des moteurs {data.watchdog.envOff ? 'coupée par le serveur' : data.watchdog.enabled ? 'active' : 'coupée'}</h2>
                  <p className="mt-1 text-sm text-gray-500">Une demande minuscule toutes les 5 minutes. Si un moteur accepte les demandes mais n’en termine plus aucune (deux fois de suite), seul le service concerné est mis en pause dans l’espace client, puis rouvert dès que le moteur répond. Chaque essai est un petit appel payant.</p>
                  {data.watchdog.envOff && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">ENGINE_WATCHDOG=off sur le serveur : la sonde ne tourne pas, quel que soit cet interrupteur.</p>}
                  {data.watchdog.enabled && !data.watchdog.envOff && <p className="mt-2 text-xs text-gray-500">La tâche planifiée <code>/api/cron/engine-watchdog</code> doit être appelée toutes les 1 à 2 minutes.</p>}
                </div>
                <Switch checked={data.watchdog.enabled} onChange={(v) => busy === null && send('watchdog', { watchdog: v })} />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-surface p-5">
            <h2 className="text-base font-semibold text-gray-900">Moteurs</h2>
            <ul className="mt-3 divide-y divide-gray-100">
              {data.engines.map((engine) => (
                <li key={engine.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="text-sm font-bold text-gray-900">{engine.codename}</span>
                  <span className={clsx('rounded-full border px-2.5 py-0.5 text-xs', STATE_TONE[engine.state])}>{STATE_LABEL[engine.state]}</span>
                  <span className="text-xs text-gray-500">{engine.accounts === 0 ? 'aucun compte' : engine.accounts === 1 ? '1 compte' : `${engine.accounts} comptes (relais entre comptes)`}{engine.cost ? ` · ${engine.cost}` : ''}{engine.hasProbe ? ' · sonde' : ''}</span>
                  {engine.setAsideReason && <span className="w-full break-words text-xs text-red-700 dark:text-red-300 sm:w-auto">{engine.setAsideReason}</span>}
                  {engine.state === 'set_aside' && (
                    <button type="button" disabled={busy !== null} onClick={() => send(`clear:${engine.id}`, { clear: engine.id })} className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      {busy === `clear:${engine.id}` ? '…' : 'Remettre en service'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            {data.services.map((service) => (
              <article key={service.id} className="rounded-3xl border border-gray-200 bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900">{service.label}</h2>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {service.outage
                        ? `En pause depuis le ${when(service.outage.since)} · ${service.outage.auto ? 'posée par la sonde, levée automatiquement' : 'posée à la main'}`
                        : 'Ouvert aux clients'}
                      {service.watched && service.watch?.failures ? ` · ${service.watch.failures} sonde${service.watch.failures > 1 ? 's' : ''} ratée${service.watch.failures > 1 ? 's' : ''} d’affilée` : ''}
                      {service.watched && service.watch?.lastProbeAt ? ` · dernière sonde ${when(service.watch.lastProbeAt)}` : ''}
                    </p>
                  </div>
                  <button type="button" disabled={busy !== null} onClick={() => togglePause(service)}
                    className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50', service.outage ? 'bg-brand text-white hover:bg-brand-hover' : 'border border-gray-200 text-gray-700 hover:bg-gray-50')}>
                    {busy === `svc:${service.id}` ? '…' : service.outage ? 'Rouvrir' : 'Mettre en pause'}
                  </button>
                </div>
                <ul className="mt-4 space-y-2">
                  {service.models.map((model) => {
                    const served = model.servedBy ? engineById(model.servedBy) : null
                    return (
                      <li key={model.id} className="grid gap-2 rounded-2xl border border-gray-100 p-3 sm:grid-cols-[1fr_220px] sm:items-center">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{model.label}</p>
                          <p className={clsx('text-xs', served ? 'text-gray-500' : 'text-red-700 dark:text-red-300')}>
                            {served
                              ? `Servi par ${served.codename}${model.fallback ? ' (bascule automatique : le moteur actif ne répond pas)' : ''}`
                              : 'Indisponible : grisé pour les clients, rien n’est débité'}
                          </p>
                        </div>
                        <Select
                          value={model.active}
                          disabled={busy !== null || model.engines.length < 2}
                          onChange={(engine) => engine !== model.active && send(`model:${model.id}`, { model: model.id, engine })}
                          options={model.engines.map((id) => {
                            const engine = engineById(id)
                            return { value: id, label: engine?.codename ?? id, hint: engine ? STATE_LABEL[engine.state] : undefined }
                          })}
                        />
                      </li>
                    )
                  })}
                </ul>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  )
}
