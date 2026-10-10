'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { REQUEST_FORMS } from '@/lib/requests'
import type { RequestKind } from '@/lib/catalog/types'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { site } from '@/config/site'

const textarea = 'w-full rounded-lg border border-gray-200 bg-surface px-4 py-2.5 text-sm outline-none transition-colors focus:border-gray-400'

/**
 * Formulaire de demande. `withContact` : visiteur non connecté (nom, e-mail, WhatsApp demandés, compte créé à l'envoi).
 */
export function RequestForm({ kind, productSlug, withContact = false, showIntro = true }: { kind: RequestKind; productSlug?: string; withContact?: boolean; showIntro?: boolean }) {
  const form = REQUEST_FORMS[kind]
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [contact, setContact] = useState({ fullName: '', email: '', phone: '', country: site.payments.defaultCountry })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const set = (id: string, value: string) => setAnswers((a) => ({ ...a, [id]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, productSlug, answers, contact: withContact ? contact : undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setSending(false)
    if (!data.success) return setError(data.message || 'Envoi impossible. Réessaie.')
    if (data.signedIn) router.push(`/demandes/${data.id}`)
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-sm text-green-700">
        <p className="text-base font-medium">Demande envoyée ✓</p>
        <p className="mt-2">Je te réponds rapidement. Un e-mail vient de t’être envoyé avec un lien pour suivre ta demande dans ton espace.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {showIntro && <p className="text-sm text-gray-600">{form.intro}</p>}
      {withContact && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Nom complet"><Input value={contact.fullName} onChange={(e) => setContact({ ...contact, fullName: e.target.value })} required autoComplete="name" /></Labeled>
          <Labeled label="E-mail"><Input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} required autoComplete="email" /></Labeled>
          <Labeled label="WhatsApp (avec l’indicatif)"><Input type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} required autoComplete="tel" placeholder="+237 6xx xx xx xx" /></Labeled>
          <Labeled label="Pays"><Input value={contact.country} onChange={(e) => setContact({ ...contact, country: e.target.value })} autoComplete="country-name" /></Labeled>
        </div>
      )}
      {form.questions.map((q) => (
        <Labeled key={q.id} label={`${q.label}${q.required ? '' : ' (facultatif)'}`}>
          {q.options ? (
            <Select value={answers[q.id] || ''} onChange={(v) => set(q.id, v)} options={q.options.map((o) => ({ value: o, label: o }))} />
          ) : q.long ? (
            <textarea className={textarea} rows={5} value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} placeholder={q.placeholder} required={q.required} maxLength={3000} />
          ) : (
            <Input value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} placeholder={q.placeholder} required={q.required} maxLength={500} />
          )}
        </Labeled>
      ))}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={sending} className="rounded-full px-6 py-3">{sending ? 'Envoi…' : 'Envoyer ma demande'}</Button>
    </form>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-gray-600">{label}</span>
      {children}
    </label>
  )
}
