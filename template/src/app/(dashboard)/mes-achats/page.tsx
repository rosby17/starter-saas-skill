import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getOwnedProducts } from '@/lib/access'
import { EmptyState } from '@/components/ui/card'
import { Reconcile } from './Reconcile'
import { COMMUNITY_SLUG } from '@/lib/catalog/slugs'

export const metadata: Metadata = { title: 'Formations' }

const CATEGORY_LABEL: Record<string, string> = { formation: 'Formation', abonnement: 'Abonnement', accompagnement: 'Accompagnement', logiciel: 'Produit', service: 'Service' }
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export default async function MyPurchasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('first_name, full_name').eq('id', user!.id).maybeSingle()
  const owned = await getOwnedProducts(supabase, user!.id)
  // Précommandes : place réservée (liste d'attente) ; à la sortie, le solde de 60 % ouvre l'accès.
  const { data: reservations } = await supabase.from('preorders').select('id, product:products(slug, title, image, preorder)').eq('user_id', user!.id).eq('status', 'reserved')
  const ids = owned.map((o) => o.product.id)

  const [{ data: lessons }, { data: progress }, { data: files }, { data: requests }] = await Promise.all([
    ids.length ? supabase.from('lessons').select('id, product_id').in('product_id', ids) : Promise.resolve({ data: [] as { id: string; product_id: string }[] }),
    supabase.from('lesson_progress').select('lesson_id').eq('user_id', user!.id),
    ids.length ? supabase.from('product_files').select('id, product_id').in('product_id', ids) : Promise.resolve({ data: [] as { id: string; product_id: string }[] }),
    supabase.from('service_requests').select('product_id').eq('user_id', user!.id),
  ])
  const done = new Set((progress ?? []).map((p) => p.lesson_id))
  const requested = new Set((requests ?? []).map((r) => r.product_id))

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <Reconcile />
      <div>
        <p className="text-sm text-gray-500">Bonjour{profile?.first_name ? ` ${profile.first_name}` : ''}</p>
        <h1 className="text-3xl md:text-4xl">Tes formations</h1>
      </div>

      {(reservations?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl">Mes réservations</h2>
          {reservations!.map((r) => {
            const p = r.product as unknown as { slug: string; title: string; image: string | null; preorder: boolean } | null
            if (!p) return null
            return (
              <Link key={r.id} href={`/dashboard/offres/${p.slug}`} className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-surface p-4 hover:border-brand">
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-14 w-24 shrink-0 rounded-xl object-cover" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{p.title}</span>
                  <span className={`block text-sm ${p.preorder ? 'text-gray-500' : 'text-green-700'}`}>
                    {p.preorder ? 'Place réservée · tu seras prévenu le premier à la sortie' : 'Elle est sortie ! Termine ton inscription avec 60 % du prix →'}
                  </span>
                </span>
              </Link>
            )
          })}
        </section>
      )}

      {!owned.length ? (
        <EmptyState
          title="Tu n'as encore rien acheté"
          text="Tes formations, kits et accompagnements apparaîtront ici, dès que ton paiement est confirmé."
          action={<Link href="/boutique" className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">Voir la boutique</Link>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {owned.map(({ product, expiresAt, active, trial }) => {
            const isSub = product.billing === 'monthly'
            const productLessons = (lessons ?? []).filter((l) => l.product_id === product.id)
            const finished = productLessons.filter((l) => done.has(l.id)).length
            const fileCount = (files ?? []).filter((f) => f.product_id === product.id).length
            const percent = productLessons.length ? Math.round((finished / productLessons.length) * 100) : 0
            const needsForm = !!product.request_kind && !requested.has(product.id)
            return (
              <article key={product.id} className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-surface">
                <div className="relative aspect-[16/9] bg-gray-100">
                  {product.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs text-white">{CATEGORY_LABEL[product.category] ?? 'Produit'}</span>
                  {trial && (
                    <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs text-white ${active ? 'bg-brand' : 'bg-gray-700'}`}>{active ? 'Essai gratuit' : 'Essai terminé'}</span>
                  )}
                  {isSub && (
                    <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs text-white ${active ? 'bg-green-700' : 'bg-red-700'}`}>{active ? 'Actif' : 'Expiré'}</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <h2 className="text-xl">{product.title}</h2>
                  {trial && expiresAt && (
                    <p className={`text-sm ${active ? 'text-brand' : 'text-gray-500'}`}>
                      {active ? `Accès offert jusqu’au ${new Date(expiresAt).toLocaleString('fr-FR', { timeZone: 'Africa/Douala', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}. Garde-le à vie en l’achetant.` : 'Ton accès gratuit de 24 h est terminé. Achète la formation pour continuer là où tu t’es arrêté.'}
                    </p>
                  )}
                  {isSub && expiresAt && (
                    <p className="text-sm text-gray-500">
                      {active ? `Actif jusqu'au ${date(expiresAt)}` : `Expiré le ${date(expiresAt)}`}
                      {product.covers_all ? ' · nouveautés de toutes tes formations' : ' · nouveautés et support'}
                    </p>
                  )}
                  {productLessons.length > 0 && (
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-gray-500">
                        <span>{finished} / {productLessons.length} leçon{productLessons.length > 1 ? 's' : ''}</span>
                        <span>{percent} %</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} /></div>
                    </div>
                  )}
                  {fileCount > 0 && <p className="text-sm text-gray-500">{fileCount} fichier{fileCount > 1 ? 's' : ''} à télécharger</p>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    {trial ? (
                      <>
                        {active && <Link href={`/cours/${product.slug}`} className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">{finished ? 'Continuer' : 'Commencer'}</Link>}
                        <Link href={`/dashboard/offres/${product.slug}`} className={active ? 'inline-flex rounded-full border border-gray-300 px-5 py-2.5 text-sm hover:border-brand' : 'inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover'}>{active ? 'Garder l’accès à vie' : 'Acheter la formation'}</Link>
                      </>
                    ) : product.slug === 'appel-1h' ? (
                      <Link href="/appels" className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">Réserver mon créneau</Link>
                    ) : isSub ? (
                      <>
                        {product.slug === COMMUNITY_SLUG && active && (
                          <Link href="/communaute" className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">Ouvrir la communauté</Link>
                        )}
                        <Link href={`/dashboard/offres/${product.slug}`} className={product.slug === COMMUNITY_SLUG && active ? 'inline-flex rounded-full border border-gray-300 px-5 py-2.5 text-sm hover:border-brand' : 'inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover'}>
                          {active ? 'Prolonger' : 'Renouveler'}
                        </Link>
                        {product.updates_for && (
                          <Link href={`/cours/${product.updates_for}`} className="inline-flex rounded-full border border-gray-300 px-5 py-2.5 text-sm hover:border-brand">Voir le cours</Link>
                        )}
                      </>
                    ) : product.external_url ? (
                      <a href={product.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">Ouvrir le logiciel ↗</a>
                    ) : (
                      <Link href={`/cours/${product.slug}`} className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">
                        {productLessons.length ? (finished ? 'Continuer' : 'Commencer') : 'Ouvrir'}
                      </Link>
                    )}
                    {needsForm && (
                      <Link href={`/demandes/nouvelle?produit=${product.slug}`} className="inline-flex rounded-full border border-gray-300 px-5 py-2.5 text-sm hover:border-brand">
                        Remplir le formulaire de départ
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
