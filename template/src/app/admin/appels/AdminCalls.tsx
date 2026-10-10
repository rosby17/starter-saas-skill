'use client'

import { useState } from 'react'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import { useRouter } from 'next/navigation'
import { clsx } from '@/lib/utils'
import { DatePicker } from '@/components/ui/date-picker'
import { useConfirm } from '@/components/ui/dialog'
import { CALL_HOURS, CALL_STATUS, slotIso, slotLabel } from '@/lib/calls/slots'

export type AdminBooking = { id: string; user_id: string; status: string; topic: string; slots: string[]; counter_at: string | null; scheduled_at: string | null; meet_url: string | null; admin_note: string | null; created_at: string; name: string; email: string; phone: string }

const field = 'w-full rounded-xl border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-brand'
const ADMIN_LABEL: Record<string, string> = { proposed: 'À confirmer', counter: 'Attend la réponse du client', confirmed: 'Confirmé', done: 'Terminé', cancelled: 'Annulé' }

export function AdminCalls({ rows }: { rows: AdminBooking[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [open, setOpen] = useState<{ id: string; mode: 'confirm' | 'counter'; slot: string; date: string; hour: string; meet: string; note: string } | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const send = async (id: string, body: Record<string, unknown>) => {
    setBusy(true)
    const res = await fetch(`/api/admin/calls/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({ success: false }))
    setBusy(false)
    setMessage({ ok: !!d.success, text: d.success ? 'Fait : le client est prévenu.' : d.message || 'Action impossible.' })
    if (d.success) { setOpen(null); router.refresh() }
  }

  if (!rows.length) return <p className="rounded-2xl border border-gray-200 bg-surface p-8 text-center text-sm text-gray-500">Aucune demande d’appel pour l’instant.</p>
  return (
    <div className="space-y-3">
      {message && <p className={clsx('rounded-2xl border px-4 py-3 text-sm', message.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800')}>{message.text}</p>}
      {rows.map((b) => {
        const st = CALL_STATUS[b.status] ?? { cls: 'border-gray-200 bg-gray-100 text-gray-600' }
        const o = open?.id === b.id ? open : null
        return (
          <article key={b.id} className={clsx('space-y-3 rounded-2xl border border-l-4 bg-surface p-5', b.status === 'proposed' ? 'border-gray-200 border-l-amber-400' : b.status === 'confirmed' ? 'border-gray-200 border-l-green-500' : 'border-gray-200')}>
            <div className="flex flex-wrap items-center gap-3">
              <span className={clsx('rounded-full border px-3 py-1 text-xs font-medium', st.cls)}>{ADMIN_LABEL[b.status] ?? b.status}</span>
              <p className="font-medium">{b.name}</p>
              <p className="text-sm text-gray-500">{b.email}{b.phone ? ` · ${b.phone}` : ''}</p>
              {b.phone && <WhatsAppButton phone={b.phone} className="ml-auto" />}
            </div>
            {b.status === 'confirmed' && <p className="text-lg font-medium">{slotLabel(b.scheduled_at)} {b.meet_url && <a href={b.meet_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-sm text-brand underline">lien de l’appel</a>}</p>}
            {b.status === 'counter' && <p className="text-sm">Tu as proposé : <strong>{slotLabel(b.counter_at)}</strong></p>}
            {b.status === 'proposed' && (
              <div className="flex flex-wrap gap-2">
                {b.slots.map((s) => (
                  <button key={s} type="button" onClick={() => setOpen({ id: b.id, mode: 'confirm', slot: s, date: '', hour: '', meet: b.meet_url ?? '', note: '' })}
                    className={clsx('rounded-full border px-4 py-2 text-sm', o?.mode === 'confirm' && o.slot === s ? 'border-brand bg-brand text-white' : 'border-gray-300 hover:border-brand')}>
                    {slotLabel(s)}
                  </button>
                ))}
              </div>
            )}
            {b.topic && <p className="whitespace-pre-line text-sm text-gray-600"><span className="text-gray-500">Sujet : </span>{b.topic}</p>}

            {o?.mode === 'confirm' && (
              <div className="grid gap-3 rounded-2xl bg-gray-100 p-4 sm:grid-cols-2">
                <label className="text-sm"><span className="mb-1 block text-gray-500">Lien de l’appel (Google Meet, Zoom…)</span>
                  <input className={field} value={o.meet} onChange={(e) => setOpen({ ...o, meet: e.target.value })} placeholder="https://meet.google.com/…" /></label>
                <label className="text-sm"><span className="mb-1 block text-gray-500">Message au client (facultatif)</span>
                  <input className={field} value={o.note} onChange={(e) => setOpen({ ...o, note: e.target.value })} placeholder="Ex. prépare tes questions" /></label>
                <div className="flex gap-2 sm:col-span-2">
                  <button type="button" disabled={busy} onClick={() => send(b.id, { action: 'confirm', slot: o.slot, meet_url: o.meet || undefined, note: o.note || undefined })} className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60">Confirmer {slotLabel(o.slot)}</button>
                  <button type="button" onClick={() => setOpen(null)} className="rounded-full border border-gray-300 px-5 py-2 text-sm">Fermer</button>
                </div>
              </div>
            )}
            {o?.mode === 'counter' && (
              <div className="space-y-3 rounded-2xl bg-gray-100 p-4">
                <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                  <DatePicker value={o.date} onChange={(v) => setOpen({ ...o, date: v })} placeholder="Choisir un jour" />
                  <div className="flex flex-wrap gap-1.5">
                    {CALL_HOURS.map((h) => (
                      <button key={h} type="button" disabled={!o.date} onClick={() => setOpen({ ...o, hour: h })}
                        className={clsx('rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40', o.hour === h ? 'border-brand bg-brand text-white' : 'border-gray-300 bg-surface')}>{h.replace(':00', ' h')}</button>
                    ))}
                  </div>
                </div>
                <input className={field} value={o.note} onChange={(e) => setOpen({ ...o, note: e.target.value })} placeholder="Message au client (facultatif)" />
                <div className="flex gap-2">
                  <button type="button" disabled={busy || !o.date || !o.hour} onClick={() => send(b.id, { action: 'counter', slot: slotIso(o.date, o.hour), note: o.note || undefined })} className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60">Proposer ce créneau</button>
                  <button type="button" onClick={() => setOpen(null)} className="rounded-full border border-gray-300 px-5 py-2 text-sm">Fermer</button>
                </div>
              </div>
            )}

            {!o && ['proposed', 'counter', 'confirmed'].includes(b.status) && (
              <div className="flex flex-wrap gap-3 text-sm">
                {b.status !== 'confirmed' && <button type="button" onClick={() => setOpen({ id: b.id, mode: 'counter', slot: '', date: '', hour: '', meet: '', note: '' })} className="text-brand underline">Proposer un autre créneau</button>}
                {b.status === 'confirmed' && <button type="button" onClick={() => send(b.id, { action: 'done' })} className="text-brand underline">Appel terminé</button>}
                <button type="button" onClick={async () => { if (await confirm({ title: 'Annuler cet appel ?', message: 'Le client est prévenu et garde son heure : il pourra proposer d’autres créneaux.', confirmLabel: 'Annuler l’appel', danger: true })) send(b.id, { action: 'cancel' }) }} className="text-red-700 underline">Annuler</button>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
