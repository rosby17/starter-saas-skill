'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { clsx } from '@/lib/utils'

// « Premiers pas » : 3 actions au plus, qui se cochent TOUTES SEULES d'après l'état réel du compte (jamais « j'ai lu le tutoriel »), puis la carte
// disparaît pour de bon (ou par « Masquer »). Remplace un tutoriel : le client apprend en faisant. Voir references/simplicite-interface.md.
export type Step = { id: string; label: string; description?: string; done: boolean; href?: string; cta?: string }

export function GettingStarted({ steps, storageKey = 'getting-started-done' }: { steps: Step[]; storageKey?: string }) {
  const [hidden, setHidden] = useState(true)                       // masquée tant qu'on n'a pas lu le navigateur : jamais de clignotement
  const tout = steps.length > 0 && steps.every((s) => s.done)
  useEffect(() => {
    try {
      if (tout) localStorage.setItem(storageKey, '1')
      setHidden(localStorage.getItem(storageKey) === '1')
    } catch { setHidden(tout) }
  }, [tout, storageKey])
  if (hidden || steps.length === 0) return null
  const next = steps.findIndex((s) => !s.done)
  const masquer = () => { try { localStorage.setItem(storageKey, '1') } catch { /* ignoré */ } setHidden(true) }
  return (
    <section className="rounded-xl border bg-surface p-5" aria-label="Premiers pas">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-base font-semibold">Premiers pas</h2>
        <span className="text-sm text-gray-500">{steps.filter((s) => s.done).length} sur {steps.length}</span>
        <button type="button" onClick={masquer} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Masquer</button>
      </div>
      <ol className="divide-y">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <span className={clsx('grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold',
              s.done ? 'border-green-600 bg-green-600 text-white' : i === next ? 'border-brand text-brand' : 'border-gray-300 text-gray-400')}>
              {s.done ? '✓' : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={clsx('block text-sm font-medium', s.done && 'text-gray-400 line-through')}>{s.label}</span>
              {s.description && <span className="block text-xs text-gray-500">{s.description}</span>}
            </span>
            {i === next && s.href && <Link href={s.href} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover">{s.cta ?? 'Commencer'}</Link>}
          </li>
        ))}
      </ol>
    </section>
  )
}
