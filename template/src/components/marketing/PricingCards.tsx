import Link from 'next/link'
import { PLANS } from '@/lib/pricing'
import { Card } from '@/components/ui/card'

export function PricingCards() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {PLANS.map((plan, i) => (
        <Card key={plan.id} className={i === 1 ? 'border-brand shadow-lg' : ''}>
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          <p className="mt-3 text-4xl font-bold">
            {plan.amountLocal === 0 ? 'Gratuit' : plan.amountLocal.toLocaleString('fr-FR')}
            {plan.amountLocal > 0 && <span className="ml-1 text-base font-normal text-gray-500">{plan.currency}</span>}
          </p>
          <ul className="mt-5 space-y-2 text-sm text-gray-600">
            {plan.features.map((f) => <li key={f}>✓ {f}</li>)}
          </ul>
          <Link href="/signup" className="mt-6 block rounded-lg bg-brand py-2 text-center text-sm font-medium text-white hover:bg-brand-hover">
            Choisir {plan.name}
          </Link>
        </Card>
      ))}
    </div>
  )
}
