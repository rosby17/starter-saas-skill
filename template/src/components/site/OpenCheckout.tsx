'use client'

import type { ReactNode } from 'react'
import { useCheckout } from '@/components/site/CheckoutModal'

// Bouton ou carte qui ouvre DIRECTEMENT la fenêtre de paiement d'une offre, sans passer par sa fiche
// (Roosevelt, 15/11/2026 : « un clic de trop » sur les abonnements).
export function OpenCheckout({ slug, className, children }: { slug: string; className?: string; children: ReactNode }) {
  const { openCheckout } = useCheckout()
  return (
    <button type="button" onClick={() => openCheckout(slug)} className={className}>
      {children}
    </button>
  )
}
