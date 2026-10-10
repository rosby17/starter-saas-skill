import type { Metadata } from 'next'
import { ReviewsSection } from '@/components/reviews/ReviewsSection'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/site/Navbar'
import Contact from '@/components/site/Contact'
import { getLessonOutline, getProductBySlug } from '@/lib/catalog/server'
import { CATEGORIES, activePromo, enrollLabel, isBuyable, preorderDeposit, pricePeriod } from '@/lib/catalog/types'
import { Price } from '@/components/Price'
import { createClient } from '@/lib/supabase/server'
import { BuyButton } from './BuyButton'
import { TrackView } from '@/components/TrackView'
import { RequestForm } from '@/components/requests/RequestForm'
import { contactLink } from '@/config/site'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug)
  if (!product) return {}
  return {
    title: product.title,
    description: product.subtitle ?? undefined,
    openGraph: { title: product.title, description: product.subtitle ?? undefined, images: product.image ? [{ url: product.image }] : undefined },
  }
}

// Fiche produit générique (les formations phares ont leur propre page de vente : sales_url).
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()
  if (product.external_url) redirect(product.external_url)

  const outline = await getLessonOutline(product.id)
  const promo = activePromo(product)
  const { data: { user } } = await (await createClient()).auth.getUser()
  const category = CATEGORIES.find((c) => c.id === product.category)

  return (
    <>
      <Navbar />
      <TrackView slug={product.slug} />
      <main style={{ padding: '140px 24px 100px' }}>
        <div className="pp-grid" style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 48, alignItems: 'start' }}>
          <div>
            <Link href={`/boutique#${product.category}`} style={{ fontSize: 13, color: 'var(--white-muted)', textDecoration: 'none' }}>← {category?.label ?? 'Boutique'}</Link>
            <h1 style={{ fontSize: 'clamp(40px, 6vw, 80px)', lineHeight: 0.98, color: 'var(--white)', margin: '16px 0 18px' }}>{product.title}</h1>
            {product.subtitle && <p style={{ fontSize: 20, color: 'var(--white-muted)', lineHeight: 1.5, marginBottom: 28 }}>{product.subtitle}</p>}
            {product.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt="" style={{ width: '100%', borderRadius: 22, border: '1px solid var(--black-line)', marginBottom: 28 }} />
            )}
            {product.description && <p style={{ whiteSpace: 'pre-line', fontSize: 17, color: 'var(--white)', opacity: 0.88, lineHeight: 1.7 }}>{product.description}</p>}
            {outline.length > 0 && (
              <section style={{ marginTop: 40 }}>
                <h2 style={{ fontSize: 28, color: 'var(--white)', marginBottom: 14 }}>Au programme</h2>
                <ol style={{ display: 'grid', gap: 8, listStyle: 'none' }}>
                  {outline.map((l, i) => (
                    <li key={i} style={{ display: 'flex', gap: 14, padding: '14px 18px', borderRadius: 14, border: '1px solid var(--black-line)', color: 'var(--white)' }}>
                      <span style={{ color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
                      {l.title}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <aside style={{ position: 'sticky', top: 110, padding: 28, borderRadius: 24, background: 'var(--black-card)', border: '1px solid var(--black-line)' }}>
            {product.features.length > 0 && (
              <ul style={{ display: 'grid', gap: 10, listStyle: 'none', marginBottom: 24 }}>
                {product.features.map((f) => (
                  <li key={f} style={{ display: 'flex', gap: 10, color: 'var(--white)', fontSize: 15 }}>
                    <span style={{ color: 'var(--brand)', fontWeight: 900 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
            )}
            {isBuyable(product) ? (
              <>
                <p style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
                  <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--white)' }}><Price fcfa={promo?.priceFcfa ?? product.price_fcfa!} /><span style={{ fontSize: 18, fontWeight: 500, color: 'var(--white-muted)' }}>{pricePeriod(product)}</span></span>
                  {(promo || product.compare_at_fcfa) && <s style={{ color: 'var(--white-dim)' }}><Price fcfa={promo ? product.price_fcfa! : product.compare_at_fcfa!} /></s>}
                </p>
                {product.preorder && (
                  <p style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 14, border: '1px solid var(--black-line)', fontSize: 15, lineHeight: 1.6, color: 'var(--white-muted)' }}>
                    <strong style={{ color: 'var(--white)' }}>Précommande.</strong> La formation est en préparation. Réserve ta place avec 10 % du prix
                    (<Price fcfa={preorderDeposit(promo?.priceFcfa ?? product.price_fcfa!)} />) : tu es sur la liste d’attente, prévenu le premier à la sortie,
                    et tu termines avec 60 % au lieu de 100 %. Plus il y a de réservations, plus vite elle sort.
                  </p>
                )}
                <BuyButton slug={product.slug} label={enrollLabel(product)} />
                <p style={{ fontSize: 13, color: 'var(--white-dim)', marginTop: 14 }}>
                  {product.billing === 'monthly'
                    ? 'Sans engagement : tu renouvelles quand tu veux, le temps restant s’ajoute. Mobile Money, carte, PayPal ou crypto.'
                    : 'Mobile Money, carte, PayPal ou crypto. Accès envoyé par e-mail, retrouvable dans « Formations ».'}
                </p>
              </>
            ) : product.request_kind ? (
              <>
                <p style={{ fontSize: 22, fontWeight: 600, color: 'var(--white)', marginBottom: 6 }}>Sur demande</p>
                <p style={{ fontSize: 14, color: 'var(--white-muted)', marginBottom: 20 }}>Décris ton besoin : je te réponds avec une proposition et un prix.</p>
                <RequestForm kind={product.request_kind} productSlug={product.slug} withContact={!user} showIntro={false} />
              </>
            ) : (
              <a href={contactLink()} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>Me contacter</a>
            )}
          </aside>
        </div>
        {(product.category === 'formation' || product.category === 'accompagnement') && <ReviewsSection productId={product.id} />}
        <style>{`@media (max-width: 900px) { .pp-grid { grid-template-columns: 1fr !important; } .pp-grid aside { position: static !important; } }`}</style>
      </main>
      <Contact />
    </>
  )
}
