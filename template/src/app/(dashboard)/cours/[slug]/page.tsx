import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getCourseSubscription, hasProductAccess } from '@/lib/access'
import { formatFcfa } from '@/lib/catalog/types'
import { clsx } from '@/lib/utils'
import { site, contactLink } from '@/config/site'
import { serviceClient } from '@/lib/auth/service-client'
import { reviewEligibility } from '@/lib/reviews/reviews'
import { ReviewForm } from '@/components/reviews/ReviewForm'
import { Lock, Check, Play, Video, PartyPopper, Download, FolderOpen } from 'lucide-react'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = { title: 'Mon cours', robots: { index: false } }

type Row = { id: string; section: string | null; title: string; summary: string | null; duration_seconds: number | null; unlocked: boolean }

const fmt = (s: number | null) => (s ? (s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`) : '')

// Le parcours d'un produit acheté : reprendre où on en était, modules en cartes, fichiers, groupe, abonnement.
// Première visite d'un cours : questionnaire d'accueil (/cours/<slug>/bienvenue).
// Lecture avec la session du client : la RLS ne renvoie les leçons et fichiers que s'il a accès au produit.
export default async function CoursePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ fini?: string }> }) {
  requireModule('formations')
  const { slug } = await params
  const { fini } = await searchParams
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: product } = await supabase.from('products').select('id, slug, title, category, request_kind').eq('slug', slug).maybeSingle()
  if (!product) notFound()
  // Pas (ou plus) d'accès, par exemple essai gratuit terminé : direction la page d'achat.
  if (!(await hasProductAccess(supabase, user!.id, product.id))) redirect(`/dashboard/offres/${product.slug}`)

  const [{ data: outline }, { data: files }, { data: privateInfo }, { data: progress }, { data: request }, { data: onboarding }, { data: profile }, sub] = await Promise.all([
    supabase.rpc('course_outline', { p_product_id: product.id }),
    supabase.from('product_files').select('id, title, size_bytes').eq('product_id', product.id).order('position'),
    supabase.from('product_private').select('group_url, welcome_message').eq('product_id', product.id).maybeSingle(),
    supabase.from('lesson_progress').select('lesson_id').eq('user_id', user!.id),
    supabase.from('service_requests').select('id, status').eq('user_id', user!.id).eq('product_id', product.id).limit(1).maybeSingle(),
    supabase.from('course_onboarding').select('answers, completed_at').eq('user_id', user!.id).eq('product_id', product.id).maybeSingle(),
    supabase.from('profiles').select('first_name, full_name').eq('id', user!.id).maybeSingle(),
    getCourseSubscription(supabase, user!.id, product.slug),
  ])
  const rows = (outline ?? []) as Row[]
  if (rows.length > 0 && !onboarding?.completed_at) redirect(`/cours/${product.slug}/bienvenue`)

  const done = new Set((progress ?? []).map((p) => p.lesson_id))
  const finished = rows.filter((r) => done.has(r.id)).length
  const pct = rows.length ? Math.round((finished / rows.length) * 100) : 0
  const resume = rows.find((r) => r.unlocked && !done.has(r.id)) ?? rows[0]
  const sections = [...new Set(rows.map((r) => r.section ?? 'Leçons'))]
  const answers = (onboarding?.answers ?? {}) as Record<string, unknown>
  const name = (typeof answers.firstName === 'string' && answers.firstName) || profile?.first_name || profile?.full_name?.split(' ')[0] || ''
  const locked = rows.filter((r) => !r.unlocked).length
  const now = Date.now()
  const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  // Avis vérifié (achat réel + au moins une leçon terminée), modifiable.
  const db = serviceClient()
  const [can, { data: myReview }] = await Promise.all([
    reviewEligibility(db, user!.id, product.id),
    db.from('course_reviews').select('rating, title, body').eq('user_id', user!.id).eq('product_id', product.id).maybeSingle(),
  ])
  const platformOn = !!sub.platformUntil && new Date(sub.platformUntil).getTime() > now
  const courseOn = !!sub.courseUntil && new Date(sub.courseUntil).getTime() > now

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <Link href="/mes-achats" className="text-sm text-gray-500 hover:text-gray-900">← Tes formations</Link>

      {fini && finished === rows.length && rows.length > 0 && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
          <PartyPopper className="mx-auto h-7 w-7 text-green-800" strokeWidth={1.8} aria-hidden />
          <p className="mt-1 font-medium text-green-800">Bravo{name ? ` ${name}` : ''}, tu as terminé tout le parcours !</p>
          <p className="mt-1 text-sm text-gray-600">Maintenant, le plus important : refais un projet à toi, de A à Z, et partage ton rendu dans le groupe.</p>
        </div>
      )}

      {/* En-tête : où j'en suis, et reprendre en un clic */}
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-surface">
        <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand">{finished ? `Bon retour${name ? `, ${name}` : ''}` : `C’est parti${name ? `, ${name}` : ''}`}</p>
            <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{product.title}</h1>
            <p className="mt-2 text-sm text-gray-500">{sections.length > 1 ? `${sections.length} modules · ` : ''}{rows.length} leçons · {finished} terminée{finished > 1 ? 's' : ''}</p>
          </div>
          {rows.length > 0 && (
            <div className="relative mx-auto grid h-28 w-28 place-items-center">
              <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--black-line)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${pct * 0.974} 100`} />
              </svg>
              <span className="text-2xl font-medium">{pct}%</span>
            </div>
          )}
        </div>
        {resume && (
          <Link href={`/cours/${product.slug}/lecon/${resume.id}`} className="group flex items-center gap-4 border-t border-gray-200 bg-gray-100/60 px-6 py-5 hover:bg-gray-100 sm:px-8">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-white transition-transform group-hover:scale-105"><Play className="ml-0.5 h-5 w-5" fill="currentColor" strokeWidth={0} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs uppercase tracking-[0.16em] text-gray-500">{finished ? 'Reprendre' : 'Commencer'}{resume.section ? ` · ${resume.section}` : ''}</span>
              <span className="block truncate text-lg">{resume.title}</span>
            </span>
            <span className="text-gray-500 transition-transform group-hover:translate-x-1">→</span>
          </Link>
        )}
      </section>

      {/* Coaching et accompagnement : ce sont des lives avec le formateur, pas des vidéos. */}
      {product.category === 'accompagnement' && (
        <section className="flex flex-wrap items-center gap-5 rounded-3xl border border-brand/30 bg-brand/5 p-6 sm:p-8">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-white" aria-hidden><Video className="h-6 w-6" strokeWidth={1.8} /></span>
          <div className="min-w-60 flex-1">
            <h2 className="text-2xl">Réserve ton live avec moi</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">Ton coaching se passe en direct, sur Google Meet. Écris-moi pour choisir le jour et l’heure : je te réponds rapidement.</p>
          </div>
          <a href={contactLink(`Bonjour, je voudrais réserver mon live pour « ${product.title} ».`)} target="_blank" rel="noopener noreferrer"
            className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand-hover">Réserver un live avec moi →</a>
        </section>
      )}

      {privateInfo?.welcome_message && (
        <div className="whitespace-pre-line rounded-2xl border border-gray-200 bg-surface p-5 text-sm leading-6 text-gray-700">{privateInfo.welcome_message}</div>
      )}

      {product.request_kind && !request && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm">
          <span>Pour démarrer, remplis le formulaire de départ : il me permet de préparer ta session.</span>
          <Link href={`/demandes/nouvelle?produit=${product.slug}`} className="ml-auto rounded-full bg-brand px-4 py-2 font-medium text-white hover:bg-brand-hover">Remplir le formulaire</Link>
        </div>
      )}

      {/* Les fichiers des projets : bien visibles, à télécharger pour refaire chaque étape */}
      {(files?.length ?? 0) > 0 && (
        <section className="rounded-3xl border-2 border-brand/40 bg-brand/5 p-6 sm:p-8">
          <div className="flex flex-wrap items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-white" aria-hidden><FolderOpen className="h-6 w-6" strokeWidth={1.8} /></span>
            <div className="min-w-60 flex-1">
              <h2 className="text-2xl">Les fichiers des projets</h2>
              <p className="mt-1 text-[15px] leading-6 text-gray-600">Tout ce que j’ai utilisé, rien de caché : scripts, voix, musiques, images, moteurs et outils. Télécharge-les et refais chaque étape chez toi ; chaque dossier contient son mode d’emploi (LISEZ-MOI).</p>
            </div>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {files!.map((f) => (
              <li key={f.id}>
                <a href={`/api/files/${f.id}/download`} className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-surface px-4 py-4 transition-colors hover:border-brand">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug">{f.title}</span>
                    {f.size_bytes ? <span className="text-xs text-gray-500">{(f.size_bytes / 1024 / 1024).toFixed(1)} Mo</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white group-hover:bg-brand-hover"><Download className="h-4 w-4" strokeWidth={2} />Télécharger</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Le parcours, module par module */}
      <div className="space-y-4">
        {sections.map((s, si) => {
          const list = rows.filter((r) => (r.section ?? 'Leçons') === s)
          const sDone = list.filter((r) => done.has(r.id)).length
          const minutes = Math.round(list.reduce((t, r) => t + (r.duration_seconds ?? 0), 0) / 60)
          const complete = sDone === list.length
          return (
            <section key={s} className="rounded-3xl border border-gray-200 bg-surface p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-medium', complete ? 'bg-brand text-white' : 'bg-gray-100')}>
                  {complete ? '✓' : si + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl leading-tight">{s}</h2>
                  <p className="mt-1 text-xs text-gray-500">{list.length} leçon{list.length > 1 ? 's' : ''}{minutes ? ` · ${minutes} min de vidéo` : ''} · {sDone}/{list.length}</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-brand" style={{ width: `${(sDone / list.length) * 100}%` }} /></div>
                </div>
              </div>
              <ol className="mt-4 space-y-1">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link href={`/cours/${product.slug}/lecon/${r.id}`} className="group flex items-start gap-4 rounded-2xl px-3 py-3 hover:bg-gray-100">
                      <span className={clsx('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-medium', done.has(r.id) ? 'bg-brand text-white' : 'border border-gray-300 text-gray-600')}>
                        {!r.unlocked ? <Lock className="h-3.5 w-3.5" /> : done.has(r.id) ? <Check className="h-4 w-4" strokeWidth={3} /> : rows.indexOf(r) + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs uppercase tracking-[0.14em] text-gray-500">Leçon {rows.indexOf(r) + 1}</span>
                        <span className={clsx('block text-[17px] leading-snug', !r.unlocked && 'text-gray-500')}>{r.title}</span>
                        {r.summary && <span className="mt-1 line-clamp-2 block text-sm text-gray-500">{r.summary}</span>}
                        {!r.unlocked && <span className="text-xs text-brand">Abonnés · nouveauté</span>}
                      </span>
                      {r.duration_seconds ? <span className="shrink-0 text-xs text-gray-500">{fmt(r.duration_seconds)}</span> : null}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )
        })}
      </div>

      {(sub.offer || platformOn) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-surface p-5 text-sm">
          {platformOn ? (
            <span><strong>Pro actif</strong> : tu restes à jour, chaque nouveau module de tes formations arrive ici dès sa sortie.</span>
          ) : courseOn ? (
            <span><strong>Mises à jour actives en continu</strong> : chaque nouveau module s’ajoute ici dès sa sortie, avec les nouveautés IA et le support.</span>
          ) : (
            <span>
              <strong>{locked > 0 ? `${locked} nouvelle${locked > 1 ? 's' : ''} leçon${locked > 1 ? 's' : ''} réservée${locked > 1 ? 's' : ''} aux abonnés.` : 'Reste à jour.'}</strong>{' '}
              Ta formation reste à toi à vie ; l'abonnement débloque les nouveautés et le support{sub.courseUntil ? ` (expiré le ${date(sub.courseUntil)})` : ''}.
            </span>
          )}
          {!platformOn && sub.offer && (
            <Link href={`/dashboard/offres/${sub.offer.slug}`} className="ml-auto rounded-full bg-brand px-4 py-2 font-medium text-white hover:bg-brand-hover">
              {courseOn ? 'Prolonger' : sub.courseUntil ? 'Renouveler' : "S'abonner"}{sub.offer.price_fcfa ? ` · ${formatFcfa(sub.offer.price_fcfa)} / mois` : ''}
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {privateInfo?.group_url && (
          <section className="rounded-2xl border border-gray-200 bg-surface p-5">
            <h2 className="mb-2 text-lg">Groupe d'entraide</h2>
            <p className="mb-4 text-sm text-gray-500">Pose tes questions, partage tes rendus, reçois mes corrections.</p>
            <a href={privateInfo.group_url} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-medium text-black">Rejoindre le groupe WhatsApp ↗</a>
          </section>
        )}
        {request && (
          <section className="rounded-2xl border border-gray-200 bg-surface p-5">
            <h2 className="mb-2 text-lg">Ma demande</h2>
            <Link href={`/demandes/${request.id}`} className="text-sm text-brand underline">Voir l'avancement</Link>
          </section>
        )}
      </div>

      {(product.category === 'formation' || product.category === 'accompagnement') && (
        <ReviewForm slug={product.slug} eligible={can.ok} reason={can.reason} initial={myReview ?? null} />
      )}

      {rows.length > 0 && (
        <p className="text-center text-xs text-gray-500">
          <Link href={`/cours/${product.slug}/bienvenue`} className="hover:text-gray-900">Refaire mon questionnaire d’accueil</Link>
        </p>
      )}
    </main>
  )
}
