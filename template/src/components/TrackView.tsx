'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Compte une visite de la fiche d'un produit (statistiques de l'admin : intérêt comparé aux ventes).
export function TrackView({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `rf_view_${slug}_${new Date().toDateString()}`
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1') } catch {}
    void createClient().rpc('track_product_view', { p_slug: slug })
  }, [slug])
  return null
}
