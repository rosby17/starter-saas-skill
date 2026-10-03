import type { Metadata } from 'next'
import { PricingCards } from '@/components/marketing/PricingCards'

export const metadata: Metadata = { title: 'Tarifs' }

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <h1 className="mb-12 text-center text-4xl font-bold">Des tarifs simples</h1>
      <PricingCards />
    </main>
  )
}
