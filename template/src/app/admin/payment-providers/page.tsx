'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ServiceLogo, ServiceModal, servicesWithKeys, useSecrets } from '@/components/admin/ServiceKeys'
import { clsx } from '@/lib/utils'

type Provider = { id: string; label: string; active: boolean; configured: boolean }
type Category = { id: string; label: string; description: string; providers: Provider[] }

// Une seule passerelle active par type de paiement, présentée en tuiles (logo officiel, état, actions).
// Le choix agit tout de suite sur le checkout ; « Clés » ouvre la même fenêtre que /admin/keys.
export default function PaymentProvidersPage() {
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const { secrets, setSecrets } = useSecrets()
  const services = servicesWithKeys(secrets ?? [])

  const load = async () => {
    try {
      const res = await fetch('/api/admin/payment-providers')
      const data = await res.json()
      if (data.success) setCategories(data.categories)
      else setError(data.message)
    } catch {
      setError('Impossible de lire les moyens de paiement. Recharge la page.')
    }
  }
  useEffect(() => { load() }, [])

  const choose = async (category: Category, provider: Provider) => {
    setError(null)
    setMessage(null)
    const res = await fetch(`/api/admin/payment-providers/${category.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: provider.id }),
    })
    const data = await res.json()
    if (!data.success) setError(data.message)
    else setMessage(`${category.label} : ${provider.label} est maintenant la passerelle active.`)
    load()
  }

  const open = services.find((s) => s.id === openId) ?? null

  return (
    <main className="max-w-6xl p-4 sm:p-8">
      <h1 className="mb-1 text-2xl font-bold">Moyens de paiement</h1>
      <p className="mb-6 text-sm text-gray-500">Pour chaque type de paiement, choisis la passerelle utilisée. Une seule est active à la fois ; tes clients ne voient jamais son nom.</p>
      {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div role="status" className="mb-4 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">{message}</div>}

      {!categories && !error && (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      )}

      {categories?.map((category) => (
        <section key={category.id} className="mb-8">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
            <h2 className="font-semibold">{category.label}</h2>
            <span className="text-sm text-gray-500">{category.description}</span>
          </div>
          <div role="radiogroup" aria-label={category.label} className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
            {category.providers.map((provider) => {
              const service = services.find((s) => s.id === provider.id)
              return (
                <div key={provider.id} className={clsx('flex flex-col gap-3 rounded-2xl border bg-white p-4', provider.active ? 'border-brand ring-1 ring-brand' : 'border-gray-200')}>
                  <div className="flex items-center gap-3">
                    <ServiceLogo service={{ name: provider.label, logo: service?.logo ?? '/logos/services/cle.svg' }} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{provider.label}</p>
                      {provider.configured ? <Badge tone="green">Clés en place</Badge> : <Badge tone={provider.active ? 'red' : 'gray'}>Clés à configurer</Badge>}
                    </div>
                  </div>
                  {service && <p className="flex-1 text-sm text-gray-500">{service.description}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" role="radio" aria-checked={provider.active}
                      variant={provider.active ? 'secondary' : 'primary'} onClick={() => { if (!provider.active) choose(category, provider) }}>
                      {provider.active ? '✓ Active' : 'Choisir'}
                    </Button>
                    {service && (
                      <Button type="button" variant="ghost" onClick={() => setOpenId(service.id)}>{provider.configured ? 'Modifier les clés' : 'Configurer'}</Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <ServiceModal service={open} onClose={() => setOpenId(null)}
        onSaved={(next, text) => { setSecrets(next); setOpenId(null); setMessage(text); load() }} />
    </main>
  )
}
