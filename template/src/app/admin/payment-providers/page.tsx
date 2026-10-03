'use client'

import { useEffect, useState } from 'react'
import { RadioCard } from '@/components/ui/choice'

type Provider = { id: string; label: string; active: boolean; configured: boolean }
type Category = { id: string; label: string; description: string; providers: Provider[] }

// Une seule passerelle active par type de paiement. Le choix agit tout de suite sur le checkout.
export default function PaymentProvidersPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch('/api/admin/payment-providers')
    const data = await res.json()
    if (data.success) setCategories(data.categories)
    else setError(data.message)
  }
  useEffect(() => { load() }, [])

  const choose = async (category: string, providerId: string) => {
    setError(null)
    const res = await fetch(`/api/admin/payment-providers/${category}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId }),
    })
    const data = await res.json()
    if (!data.success) setError(data.message)
    load()
  }

  return (
    <main className="max-w-3xl p-8">
      <h1 className="mb-2 text-2xl font-bold">Moyens de paiement</h1>
      <p className="mb-6 text-sm text-gray-500">Pour chaque type de paiement, choisis la passerelle utilisée. Une seule est active à la fois.</p>
      {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="space-y-6">
        {categories.map((category) => (
          <section key={category.id} className="rounded-2xl border border-gray-200 p-5">
            <h2 className="font-semibold">{category.label}</h2>
            <p className="mb-3 text-sm text-gray-500">{category.description}</p>
            <div role="radiogroup" aria-label={category.label} className="space-y-2">
              {category.providers.map((provider) => (
                <div key={provider.id} className="flex items-center gap-3">
                  <RadioCard checked={provider.active} onSelect={() => choose(category.id, provider.id)} label={provider.label} />
                  {!provider.configured && <a href="/admin/keys" className="shrink-0 text-xs text-amber-700 underline">clés manquantes : renseigner</a>}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
