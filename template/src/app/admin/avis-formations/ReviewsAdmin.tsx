'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'

export type AdminReview = { id: string; rating: number; title: string; body: string; progress_pct: number; hidden: boolean; hidden_reason: string | null; created_at: string; product: string; author: string }

export function ReviewsAdmin({ reviews }: { reviews: AdminReview[] }) {
  const router = useRouter()
  const [hiding, setHiding] = useState<AdminReview | null>(null)
  const [reason, setReason] = useState('')
  const send = async (id: string, hidden: boolean, why?: string) => {
    await fetch(`/api/admin/reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden, reason: why }) })
    setHiding(null); setReason(''); router.refresh()
  }
  if (!reviews.length) return <p className="rounded-2xl border border-gray-200 bg-surface p-8 text-center text-sm text-gray-500">Aucun avis pour l’instant.</p>
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <article key={r.id} className={clsx('space-y-2 rounded-2xl border bg-surface p-5', r.hidden ? 'border-red-200 opacity-70' : 'border-gray-200')}>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-brand">{'★'.repeat(r.rating)}<span className="text-gray-300">{'★'.repeat(5 - r.rating)}</span></span>
            <span className="font-medium">{r.author}</span>
            <span className="text-gray-500">· {r.product} · a suivi {r.progress_pct} % · {new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
            {r.hidden
              ? <button type="button" onClick={() => send(r.id, false)} className="ml-auto text-brand underline">Réafficher</button>
              : <button type="button" onClick={() => setHiding(r)} className="ml-auto text-red-700 underline">Masquer</button>}
          </div>
          {r.title && <p className="font-medium">{r.title}</p>}
          <p className="whitespace-pre-line text-gray-700">{r.body}</p>
          {r.hidden && <p className="text-xs text-red-700">Masqué : {r.hidden_reason}</p>}
        </article>
      ))}
      <Modal open={!!hiding} onClose={() => setHiding(null)} title="Masquer cet avis ?" subtitle="À réserver aux avis extrêmes. Un avis négatif honnête doit rester visible."
        footer={<button type="button" disabled={!reason.trim()} onClick={() => hiding && send(hiding.id, true, reason)} className="rounded-full bg-red-600 px-6 py-2.5 font-medium text-white disabled:opacity-50">Masquer</button>}>
        <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Motif (ex. insultes)" className="w-full rounded-xl border border-gray-200 bg-surface px-4 py-2.5 outline-none focus:border-brand" />
      </Modal>
    </div>
  )
}
