'use client'

import { useState } from 'react'

// Ajoute (+) ou retire (−) des crédits à un utilisateur ; la raison est obligatoire et journalisée.
export function CreditAdjustmentForm({ userId }: { userId: string }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const res = await fetch(`/api/admin/users/${userId}/credits`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount), reason }),
    })
    const data = await res.json()
    setMessage(data.success ? 'Ajusté.' : data.message)
    if (data.success) { setAmount(''); setReason('') }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="+500 / -200" className="w-24 rounded border border-gray-300 px-2 py-1 text-xs" required />
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Raison" className="w-40 rounded border border-gray-300 px-2 py-1 text-xs" required />
      <button className="rounded bg-brand px-2 py-1 text-xs text-white">Appliquer</button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </form>
  )
}
