'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/card'
import { api } from '@/components/admin/kit'
import { CATEGORIES, activePromo, formatFcfa, type Product } from '@/lib/catalog/types'
import { clsx } from '@/lib/utils'

type Stats = Record<string, { lessons: number; videos: number; files: number; buyers: number }>

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [stats, setStats] = useState<Stats>({})
  const [error, setError] = useState('')
  useEffect(() => {
    api<{ products: Product[]; stats?: Stats }>('/api/admin/products').then((d) => {
      if (!d.success) return setError(d.message || 'Erreur')
      setProducts(d.products)
      setStats(d.stats ?? {})
    })
  }, [])

  return (
    <main className="space-y-10 p-4 md:p-8">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl">Produits et cours</h1>
          <p className="text-sm text-gray-500">Clique sur une carte pour régler le prix, les leçons vidéo, les fichiers et le groupe.</p>
        </div>
        <Link href="/admin/products/new" className="ml-auto rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">Nouveau produit</Link>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!products ? <p className="text-sm text-gray-500">Chargement…</p> : CATEGORIES.map((c) => {
        const items = products.filter((p) => p.category === c.id)
        if (!items.length) return null
        return (
          <section key={c.id} className="space-y-4">
            <div className="flex items-baseline gap-3 border-b border-gray-200 pb-2">
              <h2 className="text-2xl">{c.label}</h2>
              <span className="text-sm text-gray-500">{items.length}</span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((p) => <ProductTile key={p.id} product={p} stats={stats[p.id]} />)}
            </div>
          </section>
        )
      })}
    </main>
  )
}

function ProductTile({ product: p, stats }: { product: Product; stats?: Stats[string] }) {
  const promo = activePromo(p)
  const s = stats ?? { lessons: 0, videos: 0, files: 0, buyers: 0 }
  const isCourse = p.category === 'formation'
  // Un cours sans aucune vidéo : l'acheteur ne verrait que des titres.
  const emptyCourse = isCourse && s.videos === 0
  return (
    <Link href={`/admin/products/${p.id}`} className={clsx('group flex flex-col overflow-hidden rounded-3xl border bg-surface transition-colors hover:border-brand', emptyCourse ? 'border-amber-200' : 'border-gray-200')}>
      <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <span aria-hidden className="grid h-full place-items-center text-6xl font-medium text-brand">{p.title.slice(0, 1)}</span>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          {!p.published && <Badge>Masqué</Badge>}
          {promo && <Badge tone="red">Promo</Badge>}
          {emptyCourse && <Badge tone="amber">Aucune vidéo</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="text-lg font-medium leading-snug text-gray-900">{p.title}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {p.external_url ? 'Lien externe' : p.price_fcfa == null ? 'Sur demande' : formatFcfa(promo?.priceFcfa ?? p.price_fcfa)}
          </p>
        </div>
        {!p.external_url && (
          <dl className="mt-auto grid grid-cols-4 gap-2 border-t border-gray-200 pt-3 text-center">
            <Count label="leçons" value={s.lessons} />
            <Count label="vidéos" value={s.videos} warn={isCourse && s.lessons > 0 && s.videos === 0} />
            <Count label="fichiers" value={s.files} />
            <Count label="acheteurs" value={s.buyers} />
          </dl>
        )}
      </div>
    </Link>
  )
}

function Count({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className={clsx('text-xl font-medium', warn ? 'text-amber-800' : 'text-gray-900')}>{value}</dd>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
