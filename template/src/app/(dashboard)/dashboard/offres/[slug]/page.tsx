import type { Metadata } from 'next'
import { ReviewsSection } from '@/components/reviews/ReviewsSection'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLessonOutline, getProductBySlug } from '@/lib/catalog/server'
import { CATEGORIES, activePromo, enrollLabel, formatFcfa, isBuyable, preorderBalance, preorderDeposit, pricePeriod } from '@/lib/catalog/types'
import { Price } from '@/components/Price'
import { RequestForm } from '@/components/requests/RequestForm'
import { BuyButton } from '@/app/(marketing)/boutique/[slug]/BuyButton'
import { TrackView } from '@/components/TrackView'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug)
  return { title: product?.title ?? 'Offre' }
}

// Fiche d'une offre DANS l'espace client : on achète ou on fait sa demande sans quitter son compte.
export default async function DashboardOfferPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()
  if (product.external_url) redirect(product.external_url)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Un abonnement se renouvelle : on reste sur sa fiche même s'il est actif.
  // Déjà acheté à vie : direction le cours. Un essai gratuit, lui, doit pouvoir acheter.
  if (product.billing !== 'monthly') {
    const { data: lifetime } = await supabase.from('entitlements').select('id').eq('user_id', user!.id).eq('product_id', product.id).is('revoked_at', null).is('expires_at', null).maybeSingle()
    if (lifetime) redirect(`/cours/${product.slug}`)
  }

  const [outline, { data: reservation }] = await Promise.all([
    getLessonOutline(product.id),
    supabase.from('preorders').select('status, created_at').eq('user_id', user!.id).eq('product_id', product.id).neq('status', 'cancelled').maybeSingle(),
  ])
  const promo = activePromo(product)
  const category = CATEGORIES.find((c) => c.id === product.category)

  return (
    <main className="mx-auto max-w-6xl p-6 md:p-8">
      <TrackView slug={product.slug} />
      <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← Accueil</Link>

      <div className="mt-4 grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div>
            {category && <p className="text-xs uppercase tracking-widest text-brand">{category.label}</p>}
            <h1 className="mt-2 text-4xl leading-tight md:text-5xl">{product.title}</h1>
            {product.subtitle && <p className="mt-3 text-lg text-gray-600">{product.subtitle}</p>}
          </div>
          {product.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt="" className="w-full rounded-3xl border border-gray-200" />
          )}
          {product.description && <p className="whitespace-pre-line leading-relaxed text-gray-700">{product.description}</p>}
          {outline.length > 0 && (
            <section>
              <h2 className="mb-1 text-2xl">Le programme</h2>
              <p className="mb-4 text-sm text-gray-500">{outline.length} leçons{[...new Set(outline.map((l) => l.section).filter(Boolean))].length > 1 ? `, ${[...new Set(outline.map((l) => l.section).filter(Boolean))].length} modules` : ''}. Le contenu s’ouvre dès ton paiement confirmé.</p>
              <div className="space-y-4">
                {[...new Set(outline.map((l) => l.section ?? ''))].map((sec) => (
                  <div key={sec} className="rounded-3xl border border-gray-200 bg-surface p-5">
                    {sec && <h3 className="mb-3 text-lg font-medium">{sec}</h3>}
                    <ol className="space-y-2.5">
                      {outline.map((l, i) => ({ l, i })).filter(({ l }) => (l.section ?? '') === sec).map(({ l, i }) => (
                        <li key={i} className="flex gap-4">
                          <span className="mt-0.5 w-6 shrink-0 tabular-nums text-sm text-brand">{String(i + 1).padStart(2, '0')}</span>
                          <span className="min-w-0">
                            <span className="block text-gray-900">{l.title}</span>
                            {l.summary && <span className="block text-sm text-gray-500">{l.summary}</span>}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}
          {product.sales_url && (
            <a href={product.sales_url} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900">
              Voir la page de présentation complète ↗
            </a>
          )}
        </div>

        <aside className="space-y-5 rounded-3xl border border-gray-200 bg-surface p-6 lg:sticky lg:top-6">
          {product.features.length > 0 && (
            <ul className="space-y-2.5">
              {product.features.map((f) => (
                <li key={f} className="flex gap-3 text-gray-900"><span className="font-bold text-brand">✓</span>{f}</li>
              ))}
            </ul>
          )}
          {isBuyable(product) ? (
            <div className="space-y-4">
              <p className="flex items-baseline gap-3">
                <span className="text-4xl font-semibold tracking-tight text-gray-900"><Price fcfa={promo?.priceFcfa ?? product.price_fcfa!} /><span className="text-lg font-normal text-gray-500">{pricePeriod(product)}</span></span>
                {(promo || product.compare_at_fcfa) && <s className="text-gray-500"><Price fcfa={promo ? product.price_fcfa! : product.compare_at_fcfa!} /></s>}
              </p>
              {reservation?.status === 'reserved' && product.preorder ? (
                <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Ta place est réservée. Tu seras prévenu le premier dès la sortie, et tu termineras avec 60 % du prix.</p>
              ) : reservation?.status === 'reserved' ? (
                <>
                  <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">La formation est sortie ! Ta réservation est déduite : termine ton inscription avec 60 % du prix ({formatFcfa(preorderBalance(promo?.priceFcfa ?? product.price_fcfa!))}).</p>
                  <BuyButton slug={product.slug} label="Terminer mon inscription · 60 %" balance />
                </>
              ) : (
                <>
                  {product.preorder && (
                    <p className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm leading-6 text-gray-700"><strong className="text-gray-900">Précommande.</strong> La formation est en préparation. Réserve ta place avec 10 % du prix ({formatFcfa(preorderDeposit(promo?.priceFcfa ?? product.price_fcfa!))}) : tu es sur la liste d’attente, prévenu le premier à la sortie, et tu termines avec 60 % au lieu de 100 %. Plus il y a de réservations, plus vite elle sort.</p>
                  )}
                  <BuyButton slug={product.slug} label={enrollLabel(product)} />
                </>
              )}
              <p className="text-xs text-gray-500">Mobile Money, carte, PayPal ou crypto. Dès le paiement confirmé, l’accès apparaît dans « Formations ».</p>
            </div>
          ) : product.request_kind ? (
            <div className="space-y-3">
              <p className="text-2xl font-semibold text-gray-900">Sur demande</p>
              <p className="text-sm text-gray-600">Décris ton besoin : je te réponds avec une proposition et un prix, dans « Mes demandes ».</p>
              <RequestForm kind={product.request_kind} productSlug={product.slug} showIntro={false} />
            </div>
          ) : (
            <Link href="/support" className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">Me contacter</Link>
          )}
        </aside>
      </div>
      {(product.category === 'formation' || product.category === 'accompagnement') && <ReviewsSection productId={product.id} />}
    </main>
  )
}
