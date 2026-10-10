import Link from 'next/link'
import { activePromo, preorderDeposit, type Product, pricePeriod } from '@/lib/catalog/types'
import { Price } from '@/components/Price'
import { clsx } from '@/lib/utils'

// Carte d'une offre : ouvre sa fiche DANS l'espace client (ou le logiciel / la formation si déjà acheté).
export function OfferCard({ product, owned, subscribed = false }: { product: Product; owned: boolean; subscribed?: boolean }) {
  const promo = activePromo(product)
  const external = !!product.external_url
  const href = owned ? (external ? product.external_url! : `/cours/${product.slug}`) : external ? product.external_url! : `/dashboard/offres/${product.slug}`
  const body = (
    <>
      <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <span aria-hidden className="grid h-full place-items-center text-6xl font-medium text-brand">{product.title.slice(0, 1)}</span>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          {owned && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">Acheté</span>}
          {subscribed && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">Abonnement actif</span>}
          {!owned && product.preorder && <span className="rounded-full bg-brand-hover px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">Précommande</span>}
          {!owned && !product.preorder && promo && <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">Promo</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-lg font-medium leading-snug text-gray-900">{product.title}</h3>
        {product.subtitle && <p className="line-clamp-2 text-sm text-gray-500">{product.subtitle}</p>}
        {!owned && product.preorder && product.price_fcfa != null && (
          <p className="text-sm text-gray-700">Réserve ta place : <strong><Price fcfa={preorderDeposit(promo?.priceFcfa ?? product.price_fcfa)} /></strong> (10 %), puis 60 % à la sortie.</p>
        )}
        <div className="mt-auto flex items-center gap-3 pt-3">
          {owned ? (
            <span className="text-sm font-medium text-gray-900">{external ? 'Ouvrir le logiciel' : 'Accéder'}</span>
          ) : product.price_fcfa != null ? (
            <span className="flex items-baseline gap-2 font-semibold text-gray-900">
              <Price fcfa={promo?.priceFcfa ?? product.price_fcfa} />
              {pricePeriod(product) && <span className="text-sm font-normal text-gray-500">{pricePeriod(product)}</span>}
              {(promo || product.compare_at_fcfa) && (
                <s className="text-sm font-normal text-gray-500"><Price fcfa={promo ? product.price_fcfa : product.compare_at_fcfa!} /></s>
              )}
            </span>
          ) : (
            <span className="text-sm text-gray-600">{external ? 'Voir le site' : 'Sur demande'}</span>
          )}
          <span aria-hidden className={clsx('ml-auto text-xl transition-transform group-hover:translate-x-1', owned ? 'text-green-700' : 'text-brand')}>{external ? '↗' : '→'}</span>
        </div>
      </div>
    </>
  )
  const cls = 'group flex flex-col overflow-hidden rounded-3xl border border-gray-200 bg-surface transition-colors hover:border-brand'
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
  ) : (
    <Link href={href} className={cls}>{body}</Link>
  )
}
