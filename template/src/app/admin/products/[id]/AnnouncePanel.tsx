'use client'

import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import { Checkbox } from '@/components/ui/choice'
import { useConfirm } from '@/components/ui/dialog'
import { Notice, api, inputClass } from '@/components/admin/kit'

// Annoncer une nouveauté (nouveau module, nouvelle leçon) à tous les élèves de la formation :
// cloche dans leur espace + e-mail.
export function AnnouncePanel({ productId }: { productId: string }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [email, setEmail] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const confirm = useConfirm()

  const send = async () => {
    if (!(await confirm({ title: 'Annoncer à tous tes élèves ?', message: `« ${title} » apparaîtra dans leur espace${email ? ' et partira par e-mail' : ''}. On ne peut pas l’annuler.`, confirmLabel: 'Annoncer' }))) return
    setSending(true)
    const d = await api(`/api/admin/products/${productId}/announce`, 'POST', { title, body: body || undefined, email })
    setMessage({ tone: d.success ? 'green' : 'red', text: d.message || (d.success ? 'Annoncé.' : 'Erreur.') })
    if (d.success) { setTitle(''); setBody('') }
    setSending(false)
  }

  return (
    <section className="space-y-4 rounded-3xl border border-gray-200 bg-surface p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand"><Megaphone className="h-5 w-5" strokeWidth={1.8} /></span>
        <div>
          <h2 className="text-xl">Annoncer une nouveauté</h2>
          <p className="text-sm text-gray-500">Nouveau module, nouvelle leçon : tes élèves la voient dans leur espace (cloche) et la reçoivent par e-mail.</p>
        </div>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Ex. Nouveau module : la pub de lancement d’une appli mobile" />
      <textarea className={inputClass} rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="En deux phrases : ce qu’ils vont apprendre (facultatif)" />
      <div className="flex flex-wrap items-center gap-4">
        <Checkbox checked={email} onChange={setEmail} label="Envoyer aussi par e-mail" />
        <button type="button" onClick={send} disabled={sending || title.trim().length < 3} className="ml-auto rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
          {sending ? 'Envoi…' : 'Annoncer'}
        </button>
      </div>
    </section>
  )
}
