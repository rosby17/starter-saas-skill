import Link from 'next/link'
import { CATEGORIES, type Product } from '@/lib/catalog/types'

// Accueil : les 4 rayons de la boutique, avec quelques produits de chacun.
export default function ShopTeaser({ products }: { products: Product[] }) {
  return (
    <div className="shop-teaser" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
      {CATEGORIES.map((c, i) => {
        const items = products.filter((p) => p.category === c.id).slice(0, 3)
        return (
          <Link key={c.id} href={`/boutique#${c.id}`} className="st-card" style={card}>
            <span style={{ fontSize: 13, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>0{i + 1}</span>
            <span style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.03em', color: 'var(--white)' }}>{c.label}</span>
            <span style={{ fontSize: 14, color: 'var(--white-muted)' }}>{c.intro}</span>
            <ul style={{ listStyle: 'none', display: 'grid', gap: 4, marginTop: 'auto', paddingTop: 14 }}>
              {items.map((p) => (
                <li key={p.id} style={{ fontSize: 14, color: 'var(--white)' }}>· {p.title}</li>
              ))}
            </ul>
          </Link>
        )
      })}
      <style>{`.st-card { transition: border-color .2s, transform .2s; } .st-card:hover { border-color: var(--brand) !important; transform: translateY(-2px); }`}</style>
    </div>
  )
}

const card: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8, minHeight: 240, padding: 22, borderRadius: 22,
  border: '1px solid var(--black-line)', background: 'var(--black-card)', textDecoration: 'none',
}
