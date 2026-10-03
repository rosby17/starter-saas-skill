'use client'

import { useState } from 'react'
import { useConfirm } from '@/components/ui/dialog'

// Mon compte → « Mes données » : télécharger ses données, supprimer son compte (confirmation aux couleurs du site).
export function AccountDataActions() {
  const confirm = useConfirm()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    const ok = await confirm({
      title: 'Supprimer définitivement ton compte ?',
      message: 'Ton accès, tes crédits et tes données sont effacés. Les factures restent conservées pour la comptabilité, sans lien avec toi. Cette action ne peut pas être annulée.',
      confirmLabel: 'Supprimer mon compte',
      danger: true,
    })
    if (!ok) return
    setBusy(true); setError(null)
    const res = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'SUPPRIMER' }) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!data.success) return setError(data.message || 'La suppression a échoué.')
    window.location.href = '/'
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a href="/api/account" className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200">Télécharger mes données</a>
        <button type="button" disabled={busy} onClick={remove} className="rounded-lg px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Supprimer mon compte</button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
