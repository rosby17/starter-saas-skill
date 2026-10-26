'use client'

import { useEffect, useState } from 'react'

// Bandeaux de l'espace client (vérifiés toutes les 60 s sur /api/system-status) :
//  - un service en pause (sonde des moteurs ou admin) : on le nomme, on dit que le reste marche et que rien n'est débité ;
//  - services ralentis (lib/monitoring/provider-status.ts) : message rassurant.
// Jamais de jargon ni de nom de fournisseur. Fermables ; ils reviennent si l'état change.
const SLOW = 'Nos services sont ralentis en ce moment. Vos crédits sont protégés : si une opération échoue, elle est remboursée. Réessayez dans quelques instants.'
const KEY = 'provider_banner_dismissed'

type Status = { degraded: boolean; closed: { id: string; label: string }[] }

const pausedText = (closed: Status['closed']) => {
  const names = closed.map((s) => `« ${s.label} »`)
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}` : names[0]
  return `${list} ${closed.length > 1 ? 'sont' : 'est'} en pause quelques instants, le temps que nous ${closed.length > 1 ? 'les' : 'le'} rétablissions. Le reste du site fonctionne normalement et rien ne vous est débité. ${closed.length > 1 ? 'Ils rouvriront' : 'Il rouvrira'} automatiquement.`
}

export function ProviderStatusBanner() {
  const [status, setStatus] = useState<Status>({ degraded: false, closed: [] })
  const [dismissed, setDismissed] = useState<string | null>(null)

  useEffect(() => {
    setDismissed(sessionStorage.getItem(KEY))
    let stopped = false
    const check = async () => {
      try {
        const data = await (await fetch('/api/system-status', { cache: 'no-store' })).json()
        if (stopped) return
        const closed = Array.isArray(data?.closedServices) ? (data.closedServices as Status['closed']).filter((s) => s && typeof s.label === 'string') : []
        setStatus({ degraded: Boolean(data?.providerDegraded), closed })
      } catch { /* ne pas ajouter une alerte quand le statut lui-même est injoignable */ }
    }
    void check()
    const timer = setInterval(check, 60_000)
    return () => { stopped = true; clearInterval(timer) }
  }, [])

  const message = status.closed.length ? pausedText(status.closed) : status.degraded ? SLOW : null
  // Signature de l'état affiché : une fermeture vaut pour CET état ; un nouvel état fait revenir le bandeau.
  const signature = status.closed.length ? `closed:${status.closed.map((s) => s.id).join(',')}` : 'slow'
  if (!message || dismissed === signature) return null
  return (
    <div role="status" className="flex items-start gap-3 border-b border-amber-300/40 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
      <p className="min-w-0 flex-1 break-words">{message}</p>
      <button type="button" aria-label="Fermer" onClick={() => { sessionStorage.setItem(KEY, signature); setDismissed(signature) }} className="shrink-0 px-1 hover:opacity-70">✕</button>
    </div>
  )
}
