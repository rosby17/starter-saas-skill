import type { Metadata } from 'next'
import { Suspense } from 'react'
import Navbar from '@/components/site/Navbar'
import PaymentStatus from './PaymentStatus'

export const metadata: Metadata = { title: 'Paiement', robots: { index: false } }

export default function PaymentSuccessPage() {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '120px 20px 60px' }}>
        <Suspense fallback={null}>
          <PaymentStatus />
        </Suspense>
      </main>
    </>
  )
}
