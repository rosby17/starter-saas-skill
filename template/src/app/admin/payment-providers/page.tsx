'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { clsx } from '@/lib/utils'
import { Input } from '@/components/ui/input'

type Provider = { id: string; label: string; active: boolean; configured: boolean; keyRefused: boolean }
type Category = { id: string; label: string; description: string; enabled: boolean; providers: Provider[] }

// Une seule passerelle active par type de paiement. Le choix agit tout de suite sur le checkout.
// Une carte par type de paiement ; chaque passerelle est une tuile (active, prête, ou clés à renseigner).
export default function PaymentProvidersPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch('/api/admin/payment-providers')
    const data = await res.json()
    if (data.success) setCategories(data.categories)
    else setError(data.message)
  }
  useEffect(() => { load() }, [])

  const choose = async (category: string, providerId: string) => {
    setError(null)
    setSaving(`${category}:${providerId}`)
    const res = await fetch(`/api/admin/payment-providers/${category}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId }),
    })
    const data = await res.json()
    if (!data.success) setError(data.message)
    await load()
    setSaving(null)
  }

  const toggle = async (category: string, enabled: boolean) => {
    setError(null)
    setSaving(`${category}:enabled`)
    const res = await fetch(`/api/admin/payment-providers/${category}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    const data = await res.json()
    if (!data.success) setError(data.message)
    await load()
    setSaving(null)
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="text-3xl md:text-4xl">Moyens de paiement</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-500">Pour chaque type de paiement, choisis la passerelle que tes clients verront (une seule à la fois), ou coupe-le complètement avec l’interrupteur. Le changement est immédiat.</p>
      </header>
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        {categories.map((category) => {
          const active = category.providers.find((p) => p.active)
          const off = !category.enabled
          return (
            <section key={category.id} className={clsx('flex flex-col rounded-3xl border border-gray-200 bg-surface p-6', off && 'opacity-80')}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl">{category.label}</h2>
                  <p className="mt-1 text-sm text-gray-500">{category.description}</p>
                </div>
                <span className={clsx('shrink-0 rounded-full border px-3 py-1 text-xs', off ? 'border-red-200 bg-red-50 text-red-800' : active ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-200 text-gray-500')}>
                  {off ? 'Désactivé' : active ? `Actif : ${active.label}` : 'Aucun actif'}
                </span>
              </div>
              <button type="button" role="switch" aria-checked={!off} disabled={saving !== null} onClick={() => toggle(category.id, off)}
                className="mt-4 flex items-center gap-3 self-start text-sm disabled:opacity-60">
                <span className={clsx('relative h-6 w-11 shrink-0 rounded-full transition-colors', off ? 'bg-gray-300' : 'bg-brand')}>
                  <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', off ? 'left-0.5' : 'left-[22px]')} />
                </span>
                <span className="font-medium text-gray-900">{saving === `${category.id}:enabled` ? 'Enregistrement…' : off ? 'Non proposé aux clients' : 'Proposé aux clients'}</span>
              </button>
              <div role="radiogroup" aria-label={category.label} className={clsx('mt-5 grid gap-2 sm:grid-cols-2', off && 'pointer-events-none opacity-50')} aria-disabled={off}>
                {category.providers.map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={p.active} disabled={saving !== null} onClick={() => !p.active && choose(category.id, p.id)}
                    className={clsx('flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors disabled:opacity-70',
                      p.active ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300')}>
                    <span className={clsx('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2', p.active ? 'border-brand' : 'border-gray-300')}>
                      {p.active && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{p.label}</span>
                      <span className={clsx('block text-xs', p.keyRefused ? 'font-medium text-red-700' : p.configured ? 'text-gray-500' : 'text-amber-700')}>
                        {saving === `${category.id}:${p.id}` ? 'Activation…' : p.keyRefused ? 'Clé refusée : à recoller' : p.configured ? 'Prêt' : 'Clés manquantes'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {category.providers.some((p) => p.active && p.keyRefused) && (
                <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                  {category.providers.find((p) => p.active)?.label} refuse la clé API enregistrée : tes clients passent automatiquement par {category.providers.find((p) => !p.active && p.configured && !p.keyRefused)?.label ?? 'une autre passerelle'}. Génère une nouvelle clé dans ton tableau de bord {category.providers.find((p) => p.active)?.label}, puis colle-la dans <Link href="/admin/keys" className="underline">Clés et intégrations</Link>.
                </p>
              )}
              {category.providers.some((p) => !p.configured) && (
                <Link href="/admin/keys" className="mt-4 text-xs text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline">Renseigner les clés manquantes →</Link>
              )}
            </section>
          )
        })}
      </div>

      <PaymentDetails onSaved={load} />
    </main>
  )
}

// COORDONNÉES DES PAIEMENTS MANUELS (numéros Mobile Money, Wave, ID Binance Pay, adresse USDT) : modifiables ici,
// enregistrées comme les autres clés (chiffrées, /api/admin/secrets) et lues par la page de paiement à chaque achat.
// Fenêtre pré-remplie avec les valeurs en place ; seuls les champs modifiés sont enregistrés ; un champ vidé revient
// à la valeur du serveur (ou disparaît de la page de paiement s'il n'y en a pas).
type Field = { name: string; label: string; hint?: string; placeholder?: string; check?: (v: string) => string | null }
const phone = (v: string) => (/^\+?[\d\s.-]{8,20}$/.test(v) && v.replace(/\D/g, '').length >= 8 ? null : 'Numéro invalide (chiffres, espaces et + seulement).')
const ussd = (v: string) => (/\{montant\}/i.test(v) && /^[*#\d{}a-z]+#$/i.test(v.replace(/\s/g, '')) ? null : 'Le code doit contenir {montant} et finir par # (ex. *126*14*NUMÉRO*{montant}#).')
const GROUPS: { title: string; text: string; fields: Field[] }[] = [
  {
    title: 'Mobile Money direct',
    text: 'Jusqu’à deux numéros. Code marchand facultatif : {montant} est remplacé par le montant exact, le client n’a plus qu’à composer.',
    fields: [
      { name: 'MOMO_DIRECT_1_OPERATOR', label: 'Opérateur du numéro 1', placeholder: 'Orange Money' },
      { name: 'MOMO_DIRECT_1_NUMBER', label: 'Numéro 1', placeholder: '+237 6XX XXX XXX', check: phone },
      { name: 'MOMO_DIRECT_1_USSD', label: 'Code marchand du numéro 1', placeholder: 'facultatif', check: ussd },
      { name: 'MOMO_DIRECT_2_OPERATOR', label: 'Opérateur du numéro 2', placeholder: 'MTN MoMo' },
      { name: 'MOMO_DIRECT_2_NUMBER', label: 'Numéro 2', placeholder: '+237 6XX XXX XXX', check: phone },
      { name: 'MOMO_DIRECT_2_USSD', label: 'Code marchand du numéro 2', placeholder: '*126*14*6XXXXXXXX*{montant}#', check: ussd },
      { name: 'MOMO_DIRECT_HOLDER', label: 'Titulaire des numéros', placeholder: 'NOM Prénom', check: (v) => (v.length >= 2 && v.length <= 80 ? null : '2 à 80 caractères.') },
      { name: 'MOMO_DIRECT_COUNTRY', label: 'Pays des numéros (code)', hint: 'Ex. CM : le moyen s’affiche en premier dans ce pays, en dernier ailleurs.', placeholder: 'CM', check: (v) => (/^[A-Za-z]{2}$/.test(v) ? null : 'Deux lettres (code du pays).') },
    ],
  },
  {
    title: 'Wave (manuel)',
    text: 'Le numéro qui reçoit les paiements Wave et le nom que le client voit avant d’envoyer.',
    fields: [
      { name: 'WAVE_NUMBER', label: 'Numéro Wave', placeholder: '+225 07 XX XX XX XX', check: phone },
      { name: 'WAVE_NAME', label: 'Nom affiché dans Wave', placeholder: 'NOM Prénom' },
    ],
  },
  {
    title: 'Crypto',
    text: 'Binance Pay et USDT sur le réseau TRON (TRC20). Sans l’un des deux, seul l’autre onglet s’affiche.',
    fields: [
      { name: 'BINANCE_PAY_ID', label: 'ID Binance Pay', placeholder: 'chiffres uniquement', check: (v) => (/^\d{5,15}$/.test(v) ? null : 'L’ID Binance Pay ne contient que des chiffres (5 à 15).') },
      { name: 'BINANCE_PAY_NAME', label: 'Nom affiché dans Binance', placeholder: 'NOM Prénom' },
      { name: 'USDT_TRC20_ADDRESS', label: 'Adresse USDT (TRC20)', placeholder: 'T…', check: (v) => (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v) ? null : 'Adresse TRC20 invalide : 34 caractères commençant par T.') },
    ],
  },
]
const ALL_FIELDS = GROUPS.flatMap((g) => g.fields)

function PaymentDetails({ onSaved }: { onSaved: () => void }) {
  const [initial, setInitial] = useState<Record<string, string> | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await fetch(`/api/admin/secrets?values=${ALL_FIELDS.map((f) => f.name).join(',')}`, { cache: 'no-store' })
    const data = await res.json().catch(() => null)
    if (!data?.success) { setMessage({ ok: false, text: 'Impossible de lire les coordonnées.' }); return }
    const current = Object.fromEntries(ALL_FIELDS.map((f) => [f.name, String(data.values?.[f.name] ?? '')]))
    setInitial(current)
    setValues(current)
  }
  useEffect(() => { void load() }, [])

  const changed = initial ? ALL_FIELDS.filter((f) => (values[f.name] ?? '').trim() !== (initial[f.name] ?? '').trim()) : []

  const save = async () => {
    setMessage(null)
    const nextErrors: Record<string, string> = {}
    for (const f of changed) {
      const v = (values[f.name] ?? '').trim()
      const problem = v && f.check ? f.check(v) : null
      if (problem) nextErrors[f.name] = problem
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true)
    try {
      const filled = Object.fromEntries(changed.filter((f) => (values[f.name] ?? '').trim()).map((f) => [f.name, values[f.name].trim()]))
      if (Object.keys(filled).length) {
        const res = await fetch('/api/admin/secrets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: filled }) })
        const data = await res.json().catch(() => null)
        if (!data?.success) throw new Error(data?.message || 'Enregistrement impossible.')
      }
      for (const f of changed.filter((f) => !(values[f.name] ?? '').trim())) {
        const res = await fetch(`/api/admin/secrets?name=${encodeURIComponent(f.name)}`, { method: 'DELETE' })
        const data = await res.json().catch(() => null)
        if (!data?.success) throw new Error(data?.message || 'Suppression impossible.')
      }
      await load()
      onSaved()
      setMessage({ ok: true, text: 'Coordonnées enregistrées : la page de paiement les affiche dès maintenant.' })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Enregistrement impossible.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-3xl border border-gray-200 bg-surface p-6">
      <h2 className="text-xl">Coordonnées de paiement</h2>
      <p className="mt-1 max-w-2xl text-sm text-gray-500">Numéros, ID et adresse que tes clients voient pour les paiements manuels. Un champ vidé retire l’information de la page de paiement.</p>
      {!initial ? (
        <p className="mt-4 text-sm text-gray-400">{message?.text ?? 'Chargement…'}</p>
      ) : (
        <>
          <div className="mt-5 space-y-6">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold text-gray-900">{group.title}</h3>
                <p className="mt-0.5 text-xs text-gray-500">{group.text}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {group.fields.map((f) => (
                    <label key={f.name} className="block text-sm">
                      <span className="text-gray-700">{f.label}</span>
                      <Input value={values[f.name] ?? ''} placeholder={f.placeholder} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} className={clsx('mt-1', errors[f.name] && 'border-red-400')} />
                      {errors[f.name] ? <span className="mt-1 block text-xs text-red-700 dark:text-red-300">{errors[f.name]}</span> : f.hint && <span className="mt-1 block text-xs text-gray-500">{f.hint}</span>}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" disabled={saving || changed.length === 0} onClick={save} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
              {saving ? 'Enregistrement…' : changed.length ? `Enregistrer (${changed.length})` : 'Rien à enregistrer'}
            </button>
            {message && <p role="status" className={clsx('text-sm', message.ok ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300')}>{message.text}</p>}
          </div>
        </>
      )}
    </section>
  )
}
