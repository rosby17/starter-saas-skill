import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { COMMUNITY_SLUG, loadChannels, loadFeed } from '@/lib/community/feed'
import { formatFcfa } from '@/lib/catalog/types'
import { CommunityFeed } from './CommunityFeed'
import { ChannelList } from './ChannelList'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = { title: 'Communauté' }
export const dynamic = 'force-dynamic'

// Communauté : le fil privé des abonnés (annonces, astuces, échanges). Accès revérifié par la base (RLS).
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  requireModule('communaute')
  const { g } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/communaute')
  const db = serviceClient()
  const [{ data: allowed }, { data: profile }, { data: product }] = await Promise.all([
    supabase.rpc('has_community_access'),
    db.from('profiles').select('is_admin, full_name, first_name').eq('id', user.id).maybeSingle(),
    db.from('products').select('id, title, subtitle, description, features, price_fcfa, published').eq('slug', COMMUNITY_SLUG).maybeSingle(),
  ])

  if (!allowed) {
    const open = !!product?.published && product.price_fcfa != null
    return (
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-3xl bg-gray-900 p-8 text-white md:p-10" data-theme="dark">
          <p className="text-sm uppercase tracking-[0.2em] text-brand">Communauté privée</p>
          <h1 className="mt-3 text-4xl md:text-5xl">Communauté</h1>
          <p className="mt-4 max-w-xl text-lg text-gray-300">{product?.subtitle || 'Mes astuces, mes annonces et nos échanges, entre membres.'}</p>
        </section>
        {product?.description && <p className="text-lg leading-relaxed text-gray-700">{product.description}</p>}
        {!!product?.features?.length && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {product.features.map((f: string) => <li key={f} className="rounded-2xl border border-gray-200 bg-surface p-4">{f}</li>)}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-gray-200 bg-surface p-6">
          {open ? (
            <>
              <p className="text-2xl font-medium">{formatFcfa(product!.price_fcfa!)} <span className="text-base font-normal text-gray-500">/ mois</span></p>
              <Link href={`/dashboard/offres/${COMMUNITY_SLUG}`} className="ml-auto rounded-full bg-brand px-6 py-3 font-medium text-white hover:bg-brand-hover">Rejoindre la communauté</Link>
            </>
          ) : (
            <p className="text-gray-600">La communauté ouvre très bientôt. Tu seras prévenu dans ton espace dès l’ouverture.</p>
          )}
        </div>
      </main>
    )
  }

  const channels = await loadChannels(db)
  const active = channels.find((c) => c.slug === g) ?? null
  const [posts, { count: members }] = await Promise.all([
    active ? loadFeed(db, user.id, active.id) : Promise.resolve([]),
    db.from('entitlements').select('user_id', { count: 'exact', head: true }).eq('product_id', product?.id ?? '00000000-0000-0000-0000-000000000000').is('revoked_at', null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
  ])
  const isAdmin = !!profile?.is_admin
  return (
    <main className="mx-auto max-w-6xl px-2 py-4 md:px-6 md:py-6">
      <div className="grid h-[calc(100dvh-8rem)] min-h-[540px] overflow-hidden rounded-3xl border border-gray-200 bg-surface md:grid-cols-[340px_1fr]">
        <div className={active ? 'hidden md:block' : ''}><ChannelList channels={channels} active={active?.slug ?? null} isAdmin={isAdmin} /></div>
        <div className={active ? 'min-h-0' : 'hidden md:block'}>
          {active ? <CommunityFeed key={active.id} channel={active} initial={posts} isAdmin={isAdmin} members={members ?? 0} />
            : <div className="grid h-full place-items-center bg-gray-100 p-8 text-center text-gray-500"><div><p className="text-lg text-gray-700">Communauté</p><p className="mt-1 text-sm">Choisis un groupe à gauche : les Annonces ou la Discussion.</p></div></div>}
        </div>
      </div>
    </main>
  )
}
