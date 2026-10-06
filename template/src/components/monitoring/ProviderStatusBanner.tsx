'use client'

import { useEffect, useState } from 'react'

// Bannière rassurante quand le fournisseur externe est ralenti (voir lib/monitoring/provider-status.ts).
// Adapter le texte à ton produit.
const MESSAGE = 'Nos services sont ralentis en ce moment. Vos crédits sont protégés : si une opération échoue, elle est remboursée. Réessayez dans quelques instants.'
const KEY = 'provider_banner_dismissed'

export function ProviderStatusBanner() {
  const [degraded, setDegraded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(sessionStorage.getItem(KEY) === '1')
    let stopped = false
    const check = async () => {
      try {
        const data = await (await fetch('/api/system-status', { cache: 'no-store' })).json()
        if (stopped) return
        setDegraded(Boolean(data?.providerDegraded))
        if (!data?.providerDegraded) { sessionStorage.removeItem(KEY); setDismissed(false) }
      } catch { /* ne pas ajouter une alerte quand le statut lui-même est injoignable */ }
    }
    void check()
    const timer = setInterval(check, 60_000)
    return () => { stopped = true; clearInterval(timer) }
  }, [])

  if (!degraded || dismissed) return null
  return (
    <div role="status" className="flex items-start gap-3 border-b border-amber-300/40 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <p className="flex-1">{MESSAGE}</p>
      <button type="button" aria-label="Fermer" onClick={() => { sessionStorage.setItem(KEY, '1'); setDismissed(true) }} className="shrink-0 px-1 hover:opacity-70">✕</button>
    </div>
  )
}
