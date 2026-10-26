'use client'

import { useEffect, useState } from 'react'
import { Gift, MinusCircle } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

// « Tu as reçu des crédits » : ajouts (et retraits) faits par l'administrateur depuis la dernière visite, avec le
// motif qu'il a écrit et le nouveau solde (api/credits/notices). Fermer = « vu », la fenêtre ne revient pas.
type Notice = { id: string; amount: number; note: string | null; created_at: string }

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`

export function CreditNoticeModal() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/credits/notices', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d?.notices?.length) return
        // Un court délai : la page s'affiche d'abord, la fenêtre ensuite.
        setTimeout(() => { if (active) { setNotices(d.notices); setBalance(typeof d.balance === 'number' ? d.balance : null) } }, 1200)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  const close = () => {
    setNotices([])
    void fetch('/api/credits/notices', { method: 'POST' }).catch(() => undefined)
  }
  if (!notices.length) return null
  const total = notices.reduce((s, n) => s + n.amount, 0)
  const removal = notices.some((n) => n.amount < 0)

  return (
    <Modal open onClose={close}
      title={removal ? 'Mise à jour de tes crédits' : 'Tu as reçu des crédits'}
      subtitle={removal ? 'Nous avons ajusté les crédits de ton compte.' : 'Nous avons ajouté des crédits à ton compte.'}
      icon={<span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${removal ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{removal ? <MinusCircle className="h-5 w-5" /> : <Gift className="h-5 w-5" />}</span>}
      footer={<Button onClick={close}>{removal ? 'J’ai compris' : 'Merci !'}</Button>}>
      <p className={`text-4xl font-semibold tracking-tight tabular-nums ${total >= 0 ? 'text-green-700' : 'text-red-700'}`}>{signed(total)} <span className="text-base font-normal text-gray-500">crédits</span></p>
      <ul className="mt-4 space-y-2">
        {notices.map((n) => (
          <li key={n.id} className="rounded-xl border border-gray-200 p-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium tabular-nums">{signed(n.amount)} crédits</span>
              <span className="text-xs text-gray-500">{new Date(n.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
            {n.note && <p className="mt-1 text-gray-600"><span className="font-medium text-gray-800">Motif :</span> {n.note}</p>}
          </li>
        ))}
      </ul>
      {balance !== null && <p className="mt-4 text-sm text-gray-600">Nouveau solde : <strong className="text-gray-900">{fmt(Math.max(0, balance))} crédits</strong></p>}
    </Modal>
  )
}
