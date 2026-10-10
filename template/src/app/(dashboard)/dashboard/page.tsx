import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getOwnedProducts } from '@/lib/access'
import { getPublishedProducts } from '@/lib/catalog/server'
import { formatFcfa } from '@/lib/catalog/types'
import { contactLink, contactChannel } from '@/config/site'
import { OfferCard } from '@/components/OfferCard'
import { ProBadge } from '@/components/ProBadge'
import { GraduationCap, Handshake, MessageCircle, ArrowRight, Check, type LucideIcon } from 'lucide-react'

export const metadata: Metadata = { title: 'Accueil' }

// Accueil de l'espace client : un accueil chaleureux, la formation à reprendre avec sa progression,
// la formule (Gratuit / Pro) expliquée simplement, puis les formations et accompagnements.
// Logiciels et services : page Boutique (/dashboard/boutique).
export default async function DashboardHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: profile }, owned, products, { data: pro }, { data: progress }] = await Promise.all([
    supabase.from('profiles').select('first_name, full_name').eq('id', user!.id).maybeSingle(),
    getOwnedProducts(supabase, user!.id),
    getPublishedProducts(),
    supabase.rpc('has_platform_subscription'),
    supabase.from('lesson_progress').select('lesson_id').eq('user_id', user!.id),
  ])

  const ownedIds = new Set(owned.filter((o) => o.active && o.product.billing !== 'monthly').map((o) => o.product.id))
  const activeSubs = new Set(owned.filter((o) => o.active && o.product.billing === 'monthly').map((o) => o.product.id))
  const courses = owned.filter((o) => o.active && o.product.category === 'formation' && !o.product.external_url)
  const resume = courses[0]
  const { data: outline } = resume ? await supabase.rpc('course_outline', { p_product_id: resume.product.id }) : { data: null }
  const rows = (outline ?? []) as { id: string; title: string; section: string | null; unlocked: boolean }[]
  const done = new Set((progress ?? []).map((p) => p.lesson_id))
  const finished = rows.filter((r) => done.has(r.id)).length
  const next = rows.find((r) => r.unlocked && !done.has(r.id))
  const pct = rows.length ? Math.round((finished / rows.length) * 100) : 0
  const name = profile?.first_name || profile?.full_name?.split(' ')[0] || ''
  const hour = new Date().toLocaleString('fr-FR', { hour: 'numeric', hour12: false, timeZone: 'Africa/Abidjan' })
  const hello = Number(hour) >= 18 || Number(hour) < 5 ? 'Bonsoir' : 'Bonjour'
  const proOffer = products.find((p) => p.covers_all)
  const formations = products.filter((p) => p.category === 'formation')
  const coaching = products.filter((p) => p.category === 'accompagnement')

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-5 py-8 md:px-8 md:py-10">
      <header style={{ animation: 'courseRise 0.4s ease-out both' }}>
        <p className="text-sm text-gray-500">{hello}{name ? ` ${name}` : ''}</p>
        <h1 className="mt-2 text-4xl leading-tight md:text-5xl">{resume ? 'Content de te revoir.' : 'Bienvenue chez toi.'}</h1>
        <p className="mt-3 max-w-xl text-[17px] leading-7 text-gray-600">
          {resume ? 'Prends ton temps : une leçon à la fois, et tu refais chaque étape chez toi.' : 'Ici, tu retrouves tes formations, ta progression et tout ce qu’il faut pour avancer.'}
        </p>
      </header>

      {/* La formation à reprendre */}
      {resume ? (
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-surface" style={{ animation: 'courseRise 0.45s ease-out 80ms both' }}>
          <div className="grid md:grid-cols-[1.1fr_1fr]">
            <div className="relative min-h-48 bg-gray-100">
              {resume.product.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resume.product.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
            </div>
            <div className="flex flex-col p-6 md:p-8">
              <p className="text-xs uppercase tracking-[0.2em] text-brand">{finished ? 'Ta formation en cours' : 'Ta formation t’attend'}</p>
              <h2 className="mt-2 text-2xl leading-snug">{resume.product.title}</h2>
              {rows.length > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500"><span>{finished} / {rows.length} leçons</span><span>{pct}%</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(3, pct)}%` }} /></div>
                </div>
              )}
              {next && <p className="mt-4 text-sm text-gray-600">Prochaine leçon : <span className="text-gray-900">{next.title}</span></p>}
              <Link href={next ? `/cours/${resume.product.slug}/lecon/${next.id}` : `/cours/${resume.product.slug}`}
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand-hover">
                {finished ? 'Reprendre' : 'Commencer'} →
              </Link>
            </div>
          </div>
          {courses.length > 1 && (
            <Link href="/mes-achats" className="block border-t border-gray-200 px-6 py-3 text-sm text-gray-600 hover:bg-gray-100 md:px-8">Voir mes {courses.length} formations →</Link>
          )}
        </section>
      ) : (
        <section className="rounded-3xl border border-gray-200 bg-surface p-6 md:p-8" style={{ animation: 'courseRise 0.45s ease-out 80ms both' }}>
          <p className="text-xs uppercase tracking-[0.2em] text-brand">Pour commencer</p>
          <h2 className="mt-2 text-2xl">Choisis ta première formation</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-gray-600">Dès ton paiement confirmé, elle s’ouvre ici avec un petit questionnaire d’accueil, puis ton parcours pas à pas.</p>
          <a href="#formations" className="mt-5 inline-flex rounded-full bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand-hover">Voir les formations ↓</a>
        </section>
      )}

      {/* Raccourcis */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Tile href="/mes-achats" icon={GraduationCap} title="Tes formations" text="Tous tes cours et fichiers" />
        <Tile href="/demandes" icon={Handshake} title="Devis et coaching" text="Tes demandes de service" />
        <Tile href={contactLink()} icon={MessageCircle} title="Une question ?" text={`Écris-nous sur ${contactChannel()}`} external />
      </section>

      {/* Pro = rester à jour de ses formations. Proposé seulement à ceux qui ont déjà une formation. */}
      {proOffer && (pro || courses.length > 0) && (
        <section className="relative overflow-hidden rounded-3xl border border-brand/30 bg-surface p-6 md:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative flex flex-wrap items-start gap-6">
            <div className="min-w-64 flex-1">
              <ProBadge />
              <h2 className="mt-3 text-2xl md:text-3xl">{pro ? 'Tu es membre Pro' : 'Passe en Pro'}</h2>
              <p className="mt-2 max-w-lg text-[16px] leading-7 text-gray-600">
                {pro ? 'Tu restes à jour : chaque nouveau module, chaque mise à jour de tes formations arrive dans ton espace dès sa sortie.' : 'L’IA va vite : nouveaux modèles, nouvelles tendances. Le Pro te garde à jour de toutes tes formations, chaque mois, en plus de ce que tu as acheté (à vie).'}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                {['Chaque nouveau module de tes formations', 'Les mises à jour dès leur sortie', 'Les nouveautés IA et le support', 'Sans engagement, renouvelable chaque mois'].map((t) => (
                  <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-brand" strokeWidth={2.5} />{t}</li>
                ))}
              </ul>
            </div>
            {!pro && (
              <div className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-5 sm:w-auto sm:min-w-56">
                {proOffer.price_fcfa != null && <p className="text-3xl font-medium tracking-tight">{formatFcfa(proOffer.price_fcfa)}<span className="text-base font-normal text-gray-500"> / mois</span></p>}
                <Link href={`/dashboard/offres/${proOffer.slug}`} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand-hover">Passer en Pro <ArrowRight className="h-4 w-4" /></Link>
              </div>
            )}
          </div>
        </section>
      )}

      {formations.length > 0 && (
        <section id="formations" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl md:text-3xl">Formations</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {formations.map((p) => <OfferCard key={p.id} product={p} owned={ownedIds.has(p.id)} subscribed={activeSubs.has(p.id)} />)}
          </div>
        </section>
      )}

      {coaching.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl md:text-3xl">Coaching et accompagnement</h2>
            <p className="mt-1 text-sm text-gray-500">On travaille ensemble, en direct, sur ton projet.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {coaching.map((p) => <OfferCard key={p.id} product={p} owned={ownedIds.has(p.id)} subscribed={activeSubs.has(p.id)} />)}
          </div>
        </section>
      )}

      <Link href="/dashboard/boutique" className="flex items-center justify-between gap-4 rounded-3xl border border-gray-200 bg-surface p-6 hover:border-brand">
        <span>
          <span className="block text-lg font-medium">La boutique</span>
          <span className="block text-sm text-gray-500">Produits, logiciels et services.</span>
        </span>
        <span className="text-xl text-brand">→</span>
      </Link>
    </main>
  )
}

function Tile({ href, icon: Icon, title, text, external = false }: { href: string; icon: LucideIcon; title: string; text: string; external?: boolean }) {
  const cls = 'flex items-center gap-4 rounded-2xl border border-gray-200 bg-surface p-4 transition-colors hover:border-brand'
  const body = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-700" aria-hidden><Icon className="h-5 w-5" strokeWidth={1.8} /></span>
      <span className="min-w-0"><span className="block font-medium">{title}</span><span className="block text-sm text-gray-500">{text}</span></span>
    </>
  )
  return external ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a> : <Link href={href} className={cls}>{body}</Link>
}
