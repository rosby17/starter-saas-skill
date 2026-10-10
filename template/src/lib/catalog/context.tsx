'use client'

import { createContext, useContext } from 'react'
import { activePromo, currentPrice, type Product } from './types'

// Catalogue publié, chargé une fois par le serveur (layout racine) et partagé avec les composants des pages de vente :
// les prix et promos se règlent dans /admin/products, jamais dans le code.
const CatalogContext = createContext<Product[]>([])

export function CatalogProvider({ products, children }: { products: Product[]; children: React.ReactNode }) {
  return <CatalogContext.Provider value={products}>{children}</CatalogContext.Provider>
}

export const useCatalog = () => useContext(CatalogContext)

export function useProduct(slug: string): Product | undefined {
  return useCatalog().find((p) => p.slug === slug)
}

/** Vue « offre » d'un produit pour les pages de vente : prix, prix barré, promo. */
export function useOffer(slug: string) {
  const product = useProduct(slug)
  const priceFcfa = product?.price_fcfa ?? 0
  return {
    slug,
    product,
    label: product?.title ?? '',
    priceFcfa,
    compareAtFcfa: product?.compare_at_fcfa ?? null,
    /** Prix promo s'il y en a un (même expiré : sert au rendu serveur avant que l'heure soit connue). */
    promoPriceFcfa: product?.promo_price_fcfa ?? priceFcfa,
    promoEndsAt: product?.promo_ends_at ? new Date(product.promo_ends_at).getTime() : null,
    getPromo: (now: number = Date.now()) => (product ? activePromo(product, now) : null),
    currentPrice: (now: number = Date.now()) => (product ? currentPrice(product, now) : null),
  }
}
