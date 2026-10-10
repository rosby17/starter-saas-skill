'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Filet de sécurité à l'ouverture de « Mes achats » : revérifie auprès des passerelles les commandes récentes
// non confirmées (onglet fermé avant la fin du paiement) et recharge la page si un achat vient d'être livré.
export function Reconcile() {
  const router = useRouter()
  useEffect(() => {
    let cancelled = false
    fetch('/api/payment/reconcile-pending', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.creditedCount > 0) router.refresh() })
      .catch(() => {})
    return () => { cancelled = true }
  }, [router])
  return null
}
