'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import type { CoachSettings } from '@/lib/coach/settings'

// Réglages du coach : objectif, contexte du SaaS, et signature nominative des messages aux clients (FR / EN).
// La fenêtre s'ouvre PRÉ-REMPLIE avec les valeurs en place ; seuls les champs changés sont enregistrés.

type Field = { key: keyof CoachSettings; label: string; long?: boolean; type?: string; hint?: string }
const GROUPS: { title: string; fields: Field[] }[] = [
  { title: 'Objectif et contexte', fields: [
    { key: 'monthlyGoal', label: 'Objectif de chiffre d’affaires par mois (FCFA)', type: 'number' },
    { key: 'business', label: 'Ce que vend le site, à qui', long: true },
    { key: 'idealCustomer', label: 'Client idéal (facultatif)', long: true, hint: 'Vide : le coach le déduit des plus gros acheteurs.' },
  ] },
  { title: 'Signature des messages', fields: [
    { key: 'signerName', label: 'Nom de la personne qui signe', hint: 'Vide : « L’équipe ».' },
    { key: 'signerRoleFr', label: 'Rôle (français)' },
    { key: 'signerRoleEn', label: 'Rôle (anglais)' },
    { key: 'companyName', label: 'Entreprise' },
    { key: 'taglineFr', label: 'Accroche (français)' },
    { key: 'taglineEn', label: 'Accroche (anglais)' },
  ] },
  { title: 'Contacts', fields: [
    { key: 'whatsapp', label: 'WhatsApp (avec l’indicatif)' },
    { key: 'email', label: 'E-mail affiché', type: 'email' },
    { key: 'website', label: 'Site', type: 'url' },
    { key: 'addressFr', label: 'Adresse (français)' },
    { key: 'addressEn', label: 'Adresse (anglais)' },
    { key: 'replyTo', label: 'Adresse qui reçoit les réponses des clients', type: 'email' },
  ] },
]

export function CoachSettingsButton() {
  const [open, setOpen] = useState(false)
  const [initial, setInitial] = useState<CoachSettings | null>(null)
  const [values, setValues] = useState<CoachSettings | null>(null)
  const [meta, setMeta] = useState<{ model: string; configured: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const show = async () => {
    setOpen(true)
    setSaved(false)
    setError(null)
    try {
      const json = await (await fetch('/api/admin/coach/settings', { cache: 'no-store' })).json()
      if (!json.success) return setError(json.message)
      setInitial(json.settings)
      setValues(json.settings)
      setMeta({ model: json.model, configured: json.configured })
    } catch { setError('Réglages illisibles : vérifiez la connexion.') }
  }

  const save = async () => {
    if (!values || !initial) return
    const changed = Object.fromEntries((Object.keys(values) as (keyof CoachSettings)[]).filter((k) => values[k] !== initial[k]).map((k) => [k, values[k]]))
    if (!Object.keys(changed).length) return setOpen(false)
    setSaving(true)
    setError(null)
    try {
      const json = await (await fetch('/api/admin/coach/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changed) })).json()
      if (!json.success) return setError(json.message)
      setInitial(json.settings)
      setValues(json.settings)
      setSaved(true)
    } catch { setError('Enregistrement impossible : vérifiez la connexion.') } finally { setSaving(false) }
  }

  const set = (key: keyof CoachSettings, raw: string) => setValues((v) => (v ? { ...v, [key]: key === 'monthlyGoal' ? Math.max(0, Math.round(Number(raw) || 0)) : raw } : v))

  return (
    <>
      <Button type="button" variant="secondary" onClick={show}>Réglages du coach</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Réglages du coach" className="max-w-2xl"
        subtitle={meta ? `Modèle : ${meta.model}${meta.configured ? '' : ' · aucune clé IA posée'} (changeable dans Clés et intégrations)` : undefined}
        footer={<><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Fermer</Button><Button type="button" onClick={save} disabled={saving || !values}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button></>}>
        {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {saved && <p className="mb-3 text-sm text-green-700">Réglages enregistrés : ils servent dès le prochain message et le prochain point du jour.</p>}
        {values && (
          <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
            {GROUPS.map((g) => (
              <fieldset key={g.title} className="space-y-3">
                <legend className="mb-1 text-sm font-semibold">{g.title}</legend>
                {g.fields.map((f) => (
                  <div key={f.key}>
                    <label htmlFor={`coach-${f.key}`} className="mb-1 block text-xs font-medium text-gray-500">{f.label}</label>
                    {f.long
                      ? <textarea id={`coach-${f.key}`} value={String(values[f.key])} onChange={(e) => set(f.key, e.target.value)} rows={3} maxLength={1500} className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-gray-400" />
                      : <Input id={`coach-${f.key}`} type={f.type === 'number' ? 'text' : f.type ?? 'text'} inputMode={f.type === 'number' ? 'numeric' : undefined} value={String(values[f.key])} onChange={(e) => set(f.key, e.target.value)} />}
                    {f.hint && <p className="mt-1 text-xs text-gray-500">{f.hint}</p>}
                  </div>
                ))}
              </fieldset>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}
