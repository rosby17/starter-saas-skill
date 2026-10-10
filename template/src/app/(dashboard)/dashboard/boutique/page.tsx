import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getOwnedProducts } from '@/lib/access'
import { getPublishedProducts } from '@/lib/catalog/server'
import { OfferCard } from '@/components/OfferCard'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = { title: 'Boutique' }

const SHELVES = [
  { id: 'logiciel', title: 'Logiciels et outils', text: 'Les outils que j’utilise tous les jours pour créer et vendre avec l’IA.' },
  { id: 'service', title: 'Services', text: 'Je le fais pour toi. Prix selon ta demande.' },
] as const

// Boutique de l'espace client : logiciels et services (les formations sont à l'accueil).
export default async function DashboardShop() {
  requireModule('boutique')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [owned, products] = await Promise.all([getOwnedProducts(supabase, user!.id), getPublishedProducts()])
  const ownedIds = new Set(owned.filter((o) => o.active).map((o) => o.product.id))

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-5 py-8 md:px-8 md:py-10">
      <header>
        <h1 className="text-4xl leading-tight md:text-5xl">Boutique</h1>
        <p className="mt-3 max-w-xl text-[17px] leading-7 text-gray-600">Mes logiciels et mes services, au même endroit.</p>
      </header>
      {SHELVES.map((s) => {
        const items = products.filter((p) => p.category === s.id)
        if (!items.length) return null
        return (
          <section key={s.id} className="space-y-4">
            <div>
              <h2 className="text-2xl md:text-3xl">{s.title}</h2>
              <p className="mt-1 text-sm text-gray-500">{s.text}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => <OfferCard key={p.id} product={p} owned={ownedIds.has(p.id)} />)}
            </div>
          </section>
        )
      })}
    </main>
  )
}
