'use client'

import Link from 'next/link'
import { TZ_LABEL, localDay } from '@/lib/time'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from '@/lib/utils'
import { DatePicker } from '@/components/ui/date-picker'
import { useConfirm } from '@/components/ui/dialog'
import { CALL_HOURS, CALL_SLUG, CALL_STATUS, MAX_SLOTS, slotIso, slotLabel } from '@/lib/calls/slots'

export type Booking = { id: string; status: string; topic: string; slots: string[]; counter_at: string | null; scheduled_at: string | null; meet_url: string | null; admin_note: string | null; created_at: string }

const ymd = (t: number) => localDay(t)

async function call(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return res.json().catch(() => ({ success: false }))
}

/** Choix de 1 à 3 créneaux : un jour dans le calendrier, puis une heure (heure locale). */
function SlotPicker({ bookingId, initialTopic, onDone, onCancel }: { bookingId?: string; initialTopic?: string; onDone: () => void; onCancel?: () => void }) {
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [topic, setTopic] = useState(initialTopic ?? '')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const min = ymd(Date.now() + 12 * 3600_000), max = ymd(Date.now() + 60 * 86_400_000)
  const minTime = Date.now() + 12 * 3600_000

  const toggle = (iso: string) => setSlots((s) => (s.includes(iso) ? s.filter((x) => x !== iso) : s.length >= MAX_SLOTS ? s : [...s, iso].sort()))
  const send = async () => {
    setSending(true); setError(null)
    const d = await call('/api/calls', { bookingId, slots, topic })
    setSending(false)
    if (!d.success) return setError(d.message || 'Envoi impossible.')
    onDone()
  }

  return (
    <div className="space-y-5 rounded-3xl border border-gray-200 bg-surface p-6">
      <div>
        <p className="font-medium">1. Choisis un jour</p>
        <div className="mt-2 max-w-xs"><DatePicker value={date} onChange={setDate} min={min} max={max} placeholder="Choisir un jour" /></div>
      </div>
      {date && (
        <div>
          <p className="font-medium">2. Choisis une ou plusieurs heures <span className="text-sm font-normal text-gray-500">({TZ_LABEL})</span></p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {CALL_HOURS.map((h) => {
              const iso = slotIso(date, h)
              const past = new Date(iso).getTime() < minTime
              const on = slots.includes(iso)
              return (
                <button key={h} type="button" disabled={past || (!on && slots.length >= MAX_SLOTS)} onClick={() => toggle(iso)}
                  className={clsx('rounded-xl border px-3 py-2.5 text-sm transition-colors disabled:opacity-30', on ? 'border-brand bg-brand text-white' : 'border-gray-200 hover:border-brand')}>
                  {h.replace(':00', ' h')}
                </button>
              )
            })}
          </div>
        </div>
      )}
      {slots.length > 0 && (
        <div>
          <p className="text-sm text-gray-500">Tes créneaux ({slots.length}/{MAX_SLOTS}) : propose-en plusieurs, je confirme celui qui me va.</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {slots.map((s) => (
              <li key={s} className="flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-sm">
                {slotLabel(s)}
                <button type="button" onClick={() => toggle(s)} className="text-gray-500 hover:text-red-700" aria-label="Retirer ce créneau">×</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="font-medium">3. De quoi veux-tu parler ?</p>
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} maxLength={2000} placeholder="Ton projet, tes questions, où tu bloques…"
          className="mt-2 w-full rounded-2xl border border-gray-200 bg-surface px-4 py-3 outline-none focus:border-brand" />
      </div>
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={send} disabled={!slots.length || sending} className="rounded-full bg-brand px-6 py-3 font-medium text-white hover:bg-brand-hover disabled:opacity-50">{sending ? 'Envoi…' : 'Envoyer mes créneaux'}</button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-full border border-gray-300 px-6 py-3 hover:border-gray-400">Fermer</button>}
      </div>
    </div>
  )
}

export function CallsView({ bookings, left }: { bookings: Booking[]; left: number }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const refresh = () => { setEditing(null); router.refresh() }
  const act = async (b: Booking, action: 'accept_counter' | 'cancel') => {
    if (action === 'cancel' && !(await confirm({ title: 'Annuler cette demande ?', message: 'Ton heure reste disponible : tu pourras proposer d’autres créneaux.', confirmLabel: 'Annuler la demande', danger: true }))) return
    const d = await call(`/api/calls/${b.id}`, { action })
    setMessage(d.message || (d.success ? 'Fait.' : 'Action impossible.'))
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {message && <p className="rounded-2xl border border-gray-200 bg-surface px-4 py-3 text-sm">{message}</p>}
      {left > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl">Réserver {left > 1 ? `un de mes ${left} appels` : 'mon appel'}</h2>
          <SlotPicker onDone={refresh} />
        </section>
      )}
      {bookings.map((b) => {
        const st = CALL_STATUS[b.status] ?? { label: b.status, cls: 'border-gray-200 bg-gray-100 text-gray-600' }
        return (
          <article key={b.id} className="space-y-3 rounded-3xl border border-gray-200 bg-surface p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className={clsx('rounded-full border px-3 py-1 text-xs font-medium', st.cls)}>{st.label}</span>
              <span className="text-xs text-gray-500">Demande du {new Date(b.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
            {b.status === 'confirmed' && (
              <div className="rounded-2xl bg-green-50 p-4 text-green-900">
                <p className="text-lg font-medium">{slotLabel(b.scheduled_at)}</p>
                <p className="text-sm">{TZ_LABEL} · 1 heure</p>
                {b.meet_url && <a href={b.meet_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">Rejoindre l’appel</a>}
              </div>
            )}
            {b.status === 'counter' && (
              <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p>Je te propose : <strong>{slotLabel(b.counter_at)}</strong> ({TZ_LABEL}).</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => act(b, 'accept_counter')} className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">J’accepte ce créneau</button>
                  <button type="button" onClick={() => setEditing(b.id)} className="rounded-full border border-gray-300 bg-surface px-5 py-2.5 text-sm">Proposer d’autres créneaux</button>
                </div>
              </div>
            )}
            {b.status === 'proposed' && (
              <div className="text-sm">
                <p className="text-gray-500">Tes créneaux :</p>
                <ul className="mt-1 list-disc pl-5">{b.slots.map((s) => <li key={s}>{slotLabel(s)}</li>)}</ul>
              </div>
            )}
            {b.admin_note && <p className="whitespace-pre-line rounded-2xl bg-gray-100 px-4 py-3 text-sm">{b.admin_note}</p>}
            {b.topic && <p className="whitespace-pre-line text-sm text-gray-600"><span className="text-gray-500">Sujet : </span>{b.topic}</p>}
            {['proposed', 'counter'].includes(b.status) && editing !== b.id && (
              <div className="flex flex-wrap gap-3 text-sm">
                {b.status === 'proposed' && <button type="button" onClick={() => setEditing(b.id)} className="text-brand underline">Changer mes créneaux</button>}
                <button type="button" onClick={() => act(b, 'cancel')} className="text-red-700 underline">Annuler la demande</button>
              </div>
            )}
            {editing === b.id && <SlotPicker bookingId={b.id} initialTopic={b.topic} onDone={refresh} onCancel={() => setEditing(null)} />}
          </article>
        )
      })}
      {left === 0 && (
        <p className="text-center text-sm text-gray-500">Envie d’une nouvelle heure ? <Link href={`/dashboard/offres/${CALL_SLUG}`} className="text-brand underline">Réserver une autre heure</Link></p>
      )}
    </div>
  )
}
