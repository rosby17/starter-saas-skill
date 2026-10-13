'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { clsx } from '@/lib/utils'

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
    </main>
  )
}
