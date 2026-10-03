'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/card'

type Order = {
  id: string; email: string | null; plan_name: string | null; credits: number; amount_local: number; currency: string
  payment_method: string | null; payment_ref: string | null; status: string; created_at: string
}

const STATUS_LABELS: Record<string, { label: string; tone: 'gray' | 'green' | 'red' | 'amber' }> = {
  pending: { label: 'En attente', tone: 'amber' }, success: { label: 'Payée', tone: 'green' }, failed: { label: 'Échouée', tone: 'red' },
  expired: { label: 'Expirée', tone: 'gray' }, flagged_underpaid: { label: 'Montant insuffisant', tone: 'red' }, flagged_reversal: { label: 'Remboursée / litige', tone: 'red' },
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) })
    if (status) params.set('status', status)
    if (q.trim()) params.set('q', q.trim())
    const res = await fetch(`/api/admin/orders?${params}`)
    const data = await res.json()
    if (data.success) { setOrders(data.orders); setTotal(data.total) } else setMessage(data.message)
  }, [page, status, q])
  useEffect(() => { load() }, [load])

  const act = async (id: string, action: 'verify' | 'mark_paid' | 'mark_failed') => {
    if (action === 'mark_paid' && !confirm('Confirmer que le paiement a bien été reçu ? Les crédits seront accordés.')) return
    const res = await fetch(`/api/admin/orders/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    const data = await res.json()
    setMessage(data.message || (data.credited ? 'Commande créditée.' : data.state ? `Passerelle : ${data.state}` : data.success ? 'Fait.' : 'Échec.'))
    load()
  }

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Commandes</h1>
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value) }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} placeholder="Numéro de commande ou référence" className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <span className="self-center text-sm text-gray-500">{total} commande(s)</span>
      </div>
      {message && <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">{message}</div>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500"><th className="py-2">Date</th><th>Client</th><th>Forfait</th><th>Montant</th><th>Moyen</th><th>Statut</th><th /></tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const st = STATUS_LABELS[o.status] || { label: o.status, tone: 'gray' as const }
            return (
              <tr key={o.id} className="border-b border-gray-100 align-top">
                <td className="py-2">{new Date(o.created_at).toLocaleString('fr-FR')}</td>
                <td>{o.email || '—'}</td>
                <td>{o.plan_name}<div className="text-xs text-gray-400">{o.credits.toLocaleString('fr-FR')} crédits</div></td>
                <td>{o.amount_local.toLocaleString('fr-FR')} {o.currency}</td>
                <td>{o.payment_method}<div className="text-xs text-gray-400">{o.payment_ref}</div></td>
                <td><Badge tone={st.tone}>{st.label}</Badge></td>
                <td className="space-x-2 whitespace-nowrap py-2 text-right">
                  {['pending', 'failed', 'expired'].includes(o.status) && (<>
                    <button onClick={() => act(o.id, 'verify')} className="text-blue-700 underline">Vérifier</button>
                    <button onClick={() => act(o.id, 'mark_paid')} className="text-green-700 underline">Marquer payée</button>
                  </>)}
                  {o.status === 'pending' && <button onClick={() => act(o.id, 'mark_failed')} className="text-red-700 underline">Abandonner</button>}
                  {o.status === 'success' && <a href={`/billing/invoice/${o.id}`} target="_blank" className="text-gray-700 underline">Facture</a>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="mt-4 flex items-center gap-3 text-sm">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Précédent</button>
        <span>Page {page}</span>
        <button disabled={page * 25 >= total} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Suivant</button>
      </div>
    </main>
  )
}
