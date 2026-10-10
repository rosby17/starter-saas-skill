'use client'

import { useCheckout } from '@/components/site/CheckoutModal'

export function BuyButton({ slug, label = 'Commander', balance = false }: { slug: string; label?: string; balance?: boolean }) {
  const { openCheckout } = useCheckout()
  return (
    <button type="button" onClick={() => openCheckout(slug, { balance })} style={{ width: '100%', height: 56, borderRadius: 999, border: 'none', background: 'var(--brand)', color: '#fff', fontSize: 17, fontWeight: 600, cursor: 'pointer' }}>
      {label}
    </button>
  )
}
