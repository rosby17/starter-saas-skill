import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/site/Navbar'
import Contact from '@/components/site/Contact'
import ProductCard, { productCardCss } from '@/components/site/ProductCard'
import { getPublishedProducts } from '@/lib/catalog/server'
import { CATEGORIES } from '@/lib/catalog/types'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = {
  title: 'Boutique',
  description: 'Formations, accompagnements, logiciels et services : tout ce que je propose, payable en Mobile Money, carte, PayPal ou crypto.',
}

export default async function ShopPage() {
  requireModule('boutique')
  const products = await getPublishedProducts()
  return (
    <>
      <Navbar />
      <main style={{ padding: '150px 24px 100px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--white-muted)', marginBottom: 18 }}>
            <span style={{ color: 'var(--brand)' }}>✲</span> Boutique
          </p>
          <h1 style={{ fontSize: 'clamp(48px, 9vw, 140px)', lineHeight: 0.92, color: 'var(--white)', marginBottom: 24 }}>
            Apprends, lance,
            <br />
            <span style={{ color: 'var(--brand)' }}>ou délègue.</span>
          </h1>
          <p style={{ maxWidth: 640, fontSize: 18, color: 'var(--white-muted)', lineHeight: 1.6, marginBottom: 40 }}>
            Paiement Mobile Money, carte, PayPal ou crypto. Ton accès arrive par e-mail et reste dans ton espace « Formations ».
          </p>
          <nav aria-label="Rayons" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 72 }}>
            {CATEGORIES.filter((c) => c.id !== 'abonnement').map((c) => (
              <a key={c.id} href={`#${c.id}`} style={chip}>{c.label}</a>
            ))}
            <Link href="/mes-achats" style={{ ...chip, borderColor: 'var(--brand)' }}>Tes formations →</Link>
          </nav>

          {CATEGORIES.filter((c) => c.id !== 'abonnement').map((c) => {
            const items = products.filter((p) => p.category === c.id)
            if (!items.length) return null
            return (
              <section key={c.id} id={c.id} style={{ scrollMarginTop: 100, marginBottom: 88 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 20px', marginBottom: 24 }}>
                  <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', color: 'var(--white)' }}>{c.label}</h2>
                  <p style={{ color: 'var(--white-muted)' }}>{c.intro}</p>
                </div>
                <div className="shop-grid">
                  {items.map((p) => <ProductCard key={p.id} product={p} />)}
                </div>
              </section>
            )
          })}

        </div>
        <style>{productCardCss + `.shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }`}</style>
      </main>
      <Contact />
    </>
  )
}

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 20px', borderRadius: 999,
  border: '1px solid var(--black-line)', color: 'var(--white)', textDecoration: 'none', fontSize: 15,
}
