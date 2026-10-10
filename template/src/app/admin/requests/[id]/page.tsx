'use client'

import Link from 'next/link'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import { use, useEffect, useState } from 'react'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/choice'
import { Button } from '@/components/ui/button'
import { Notice, api, inputClass } from '@/components/admin/kit'
import { REQUEST_KINDS, type RequestKind } from '@/lib/catalog/types'
import { REQUEST_FORMS, REQUEST_STATUS } from '@/lib/requests'

type Data = {
  request: { id: string; kind: string; status: string; details: string; answers: Record<string, string>; admin_reply: string | null; created_at: string; user_id: string }
  profile: { id: string; full_name: string | null; email: string | null; phone: string | null; country: string | null } | null
  product: { title: string } | null
}

export default function AdminRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<Data | null>(null)
  const [status, setStatus] = useState('nouvelle')
  const [reply, setReply] = useState('')
  const [notify, setNotify] = useState(true)
  const [message, setMessage] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)

  useEffect(() => {
    api<Data>(`/api/admin/requests/${id}`).then((d) => {
      if (!d.success) return setMessage({ tone: 'red', text: d.message || 'Demande introuvable.' })
      setData(d)
      setStatus(d.request.status)
      setReply(d.request.admin_reply ?? '')
    })
  }, [id])

  const save = async () => {
    const d = await api<{ emailed: boolean }>(`/api/admin/requests/${id}`, 'PATCH', { status, admin_reply: reply, notify })
    setMessage(d.success ? { tone: 'green', text: d.emailed ? 'Enregistré, le client est prévenu par e-mail.' : 'Enregistré.' } : { tone: 'red', text: d.message || 'Erreur.' })
  }

  if (!data) return <main className="p-8 text-sm text-gray-500">{message?.text ?? 'Chargement…'}</main>
  const kind = data.request.kind as RequestKind
  const phone = data.profile?.phone?.replace(/[^\d]/g, '')

  return (
    <main className="max-w-4xl space-y-6 p-4 md:p-8">
      <div>
        <Link href="/admin/requests" className="text-sm text-gray-500 hover:text-gray-900">← Demandes</Link>
        <h1 className="mt-2 text-3xl">{REQUEST_KINDS[kind] ?? kind}</h1>
        <p className="text-sm text-gray-500">{new Date(data.request.created_at).toLocaleString('fr-FR')}{data.product ? ` · ${data.product.title}` : ''}</p>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {data.profile && (
        <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-surface p-5 text-sm">
          <Link href={`/admin/customers/${data.profile.id}`} className="font-medium hover:text-brand">{data.profile.full_name || data.profile.email}</Link>
          <a href={`mailto:${data.profile.email}`} className="underline">{data.profile.email}</a>
          {phone && <WhatsAppButton phone={phone} label={data.profile.phone ?? 'WhatsApp'} />}
          {data.profile.country && <span className="text-gray-500">{data.profile.country}</span>}
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-surface p-5">
        <dl className="space-y-3 text-sm">
          {(REQUEST_FORMS[kind]?.questions ?? []).filter((q) => data.request.answers?.[q.id]).map((q) => (
            <div key={q.id}><dt className="text-gray-500">{q.label}</dt><dd className="whitespace-pre-line">{data.request.answers[q.id]}</dd></div>
          ))}
        </dl>
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-surface p-5">
        <h2 className="text-xl">Réponse</h2>
        <Select className="w-56" value={status} onChange={setStatus} options={Object.entries(REQUEST_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
        <textarea className={inputClass} rows={6} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ta réponse au client (prix, date de la séance, prochaine étape…)" />
        <Checkbox checked={notify} onChange={setNotify} label="Prévenir le client par e-mail" />
        <Button onClick={save} className="rounded-full px-6">Enregistrer</Button>
      </section>
    </main>
  )
}
