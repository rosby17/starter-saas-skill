'use client'

import { useCurrency } from '@/lib/content/display-currency'

// Prix d'un produit selon la zone du visiteur (FCFA, € ou $, voir lib/pricing/zones.ts).
// Utilisable dans une page serveur : le prix catalogue en FCFA est passé tel quel.
export function Price({ fcfa }: { fcfa: number }) {
  const { formatPrice } = useCurrency()
  return <>{formatPrice(fcfa)}</>
}
