import Link from 'next/link'
import { site } from '@/config/site'
import { Card } from '@/components/ui/card'
import { PricingCards } from '@/components/marketing/PricingCards'

export default function LandingPage() {
  return (
    <main>
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">{site.tagline}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">{site.description}</p>
        <div className="mt-10 flex justify-center gap-3">
          <Link href="/signup" className="rounded-lg bg-gray-900 px-6 py-3 font-medium text-white hover:bg-gray-800">Essayer gratuitement</Link>
          <Link href="/pricing" className="rounded-lg bg-gray-100 px-6 py-3 font-medium text-gray-900 hover:bg-gray-200">Voir les tarifs</Link>
        </div>
      </section>

      <section id="fonctionnalites" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">Fonctionnalités</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {site.features.map((f) => (
            <Card key={f.title}>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{f.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-10 text-center text-3xl font-bold">Tarifs</h2>
        <PricingCards />
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="mb-8 text-center text-3xl font-bold">Questions fréquentes</h2>
        <div className="space-y-3">
          {site.faq.map((item) => (
            <details key={item.q} className="rounded-xl border border-gray-200 bg-white p-4">
              <summary className="cursor-pointer font-medium">{item.q}</summary>
              <p className="mt-2 text-sm text-gray-600">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-gray-900 py-20 text-center text-white">
        <h2 className="text-3xl font-bold">Prêt à commencer ?</h2>
        <Link href="/signup" className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-medium text-gray-900">Créer mon compte</Link>
      </section>
    </main>
  )
}
