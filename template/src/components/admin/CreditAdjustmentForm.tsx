'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/choice'

// Ajoute (+) ou retire (−) des crédits à un utilisateur ; la raison est obligatoire, journalisée ET montrée au client
// (notification, fenêtre « Tu as reçu des crédits » à sa prochaine visite, e-mail si la case est cochée).
// Le compte se choisit avec <UserSearch> (components/admin/UserTools.tsx).
export function CreditAdjustmentForm({ userId, onDone }: { userId: string; onDone?: () => void }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/credits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount.replace(/[\s−]/g, (c) => (c === '−' ? '-' : ''))), reason, notify }),
      })
      const data = await res.json()
      setMessage({ ok: data.success, text: data.message || (data.success ? 'Crédits ajustés.' : 'Ajustement impossible.') })
      if (data.success) { setAmount(''); setReason(''); onDone?.() }
    } catch {
      setMessage({ ok: false, text: 'Ajustement impossible : vérifie ta connexion.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="+500 / -200" inputMode="numeric" aria-label="Crédits" className="w-32 py-2" required />
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (visible par le client)" aria-label="Motif visible par le client" className="min-w-40 flex-1 py-2" required />
      <Button type="submit" disabled={busy}>{busy ? 'Un instant…' : 'Appliquer'}</Button>
      <div className="w-full"><Checkbox checked={notify} onChange={setNotify} label="Prévenir aussi le client par e-mail (montant, motif, nouveau solde)" /></div>
      {message && <span role="status" className={`w-full text-sm ${message.ok ? 'text-green-700' : 'text-red-700'}`}>{message.text}</span>}
    </form>
  )
}
