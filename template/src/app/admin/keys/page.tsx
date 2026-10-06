'use client'

import { useEffect, useRef, useState } from 'react'
import { ServiceModal, ServiceTile, serviceState, servicesWithKeys, useSecrets } from '@/components/admin/ServiceKeys'
import { SERVICE_SECTIONS } from '@/lib/secrets/services'
import { Skeleton } from '@/components/ui/skeleton'
import { clsx } from '@/lib/utils'

type Filter = 'all' | 'todo' | 'done'
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'todo', label: 'À configurer' },
  { id: 'done', label: 'Configurés' },
]

// Clés et intégrations : une tuile par service (logo, état, bouton), la saisie dans une fenêtre.
// Les clés sont chiffrées et actives dès l'enregistrement (pas de redéploiement).
export default function KeysPage() {
  const { secrets, setSecrets, error } = useSecrets()
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const focusDone = useRef(false)

  const services = servicesWithKeys(secrets ?? [])
  const ready = services.filter((s) => serviceState(s).ready).length
  const todo = services.filter((s) => !serviceState(s).ready && serviceState(s).required).length

  // Lien « Renseigner » du bandeau (?focus=NOM_DE_CLE) : ouvre directement la fenêtre du bon service.
  useEffect(() => {
    if (!secrets || focusDone.current) return
    focusDone.current = true // une seule fois : pas de réouverture après un enregistrement
    const focus = new URLSearchParams(window.location.search).get('focus')
    const target = focus && servicesWithKeys(secrets).find((s) => s.keys.includes(focus))
    if (target) setOpenId(target.id)
  }, [secrets])

  const keep = (id: string) => {
    const state = serviceState(services.find((s) => s.id === id)!)
    return filter === 'all' || (filter === 'done' ? state.ready : !state.ready)
  }
  const open = services.find((s) => s.id === openId) ?? null

  return (
    <main className="max-w-6xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-bold">Clés et intégrations</h1>
      <p className="mb-6 text-sm text-gray-500">Les clés sont chiffrées, jamais réaffichées en entier, et prises en compte tout de suite. Une clé saisie ici remplace celle du serveur.</p>

      {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="mb-4 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">{message}</div>}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{secrets ? `${ready} service${ready > 1 ? 's' : ''} prêt${ready > 1 ? 's' : ''} sur ${services.length}` : 'Chargement…'}</p>
          {secrets && <p className="text-sm text-gray-500">{todo ? `${todo} à configurer pour ce qui est activé.` : 'Tout l’essentiel est réglé.'}</p>}
        </div>
        <div role="tablist" aria-label="Filtrer les services" className="flex gap-1 rounded-full bg-gray-100 p-1">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className={clsx('rounded-full px-3 py-1.5 text-sm transition-colors', filter === f.id ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {!secrets && !error && (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      )}

      {secrets && SERVICE_SECTIONS.map((section) => {
        const list = services.filter((s) => s.section === section && keep(s.id))
        if (!list.length) return null
        return (
          <section key={section} className="mb-8">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
              <h2 className="font-semibold">{section}</h2>
              {section === 'Paiement' && <span className="text-sm text-gray-500">une seule passerelle suffit pour commencer</span>}
            </div>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
              {list.map((s) => <ServiceTile key={s.id} service={s} onOpen={() => { setOpenId(s.id); setMessage(null) }} />)}
            </div>
          </section>
        )
      })}
      {secrets && !services.some((s) => keep(s.id)) && <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">Rien dans ce filtre.</p>}

      <ServiceModal service={open} onClose={() => setOpenId(null)}
        onSaved={(next, text) => { setSecrets(next); setOpenId(null); setMessage(text) }} />
    </main>
  )
}
