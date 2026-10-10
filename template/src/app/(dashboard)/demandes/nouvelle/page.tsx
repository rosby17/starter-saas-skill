import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { RequestForm } from '@/components/requests/RequestForm'
import { REQUEST_FORMS } from '@/lib/requests'
import { REQUEST_KINDS, type RequestKind } from '@/lib/catalog/types'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = { title: 'Nouvelle demande' }

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ produit?: string; type?: string }> }) {
  requireModule('demandes')
  const { produit, type } = await searchParams
  const supabase = await createClient()
  let kind: RequestKind | null = type && type in REQUEST_KINDS ? (type as RequestKind) : null
  let productSlug: string | undefined
  let productTitle: string | undefined
  if (produit && /^[a-z0-9-]{1,80}$/.test(produit)) {
    const { data: product } = await supabase.from('products').select('slug, title, request_kind').eq('slug', produit).maybeSingle()
    if (product?.request_kind) {
      kind = product.request_kind as RequestKind
      productSlug = product.slug
      productTitle = product.title
    }
  }

  if (!kind) {
    const choices: RequestKind[] = ['projet', 'design', 'accompagnement', 'audit', 'autre']
    return (
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <h1 className="text-3xl">Nouvelle demande</h1>
        <div className="grid gap-3 sm:grid-cols-2">
          {choices.map((k) => (
            <Link key={k} href={`/demandes/nouvelle?type=${k}`} className="rounded-2xl border border-gray-200 bg-surface p-5 hover:border-brand">
              <p className="font-medium">{REQUEST_KINDS[k]}</p>
              <p className="mt-1 text-sm text-gray-500">{REQUEST_FORMS[k].intro}</p>
            </Link>
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/demandes" className="text-sm text-gray-500 hover:text-gray-900">← Mes demandes</Link>
        <h1 className="mt-2 text-3xl">{REQUEST_FORMS[kind].title}</h1>
        {productTitle && <p className="text-sm text-gray-500">{productTitle}</p>}
      </div>
      <div className="rounded-2xl border border-gray-200 bg-surface p-6">
        <RequestForm kind={kind} productSlug={productSlug} />
      </div>
    </main>
  )
}
