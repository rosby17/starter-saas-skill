import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { hasProductAccess } from '@/lib/access'
import type { Answers } from '@/lib/course/onboarding'
import { OnboardingFlow } from './OnboardingFlow'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = { title: 'Bienvenue dans ta formation', robots: { index: false } }

// Première entrée dans un cours : questionnaire d'accueil, un écran par question (?refaire=1 pour le refaire).
export default async function BienvenuePage({ params }: { params: Promise<{ slug: string }> }) {
  requireModule('formations')
  const { slug } = await params
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: product } = await supabase.from('products').select('id, slug, title').eq('slug', slug).maybeSingle()
  if (!product) notFound()
  // Pas (ou plus) d'accès, par exemple essai gratuit terminé : direction la page d'achat.
  if (!(await hasProductAccess(supabase, user!.id, product.id))) redirect(`/dashboard/offres/${product.slug}`)

  const [{ data: profile }, { data: saved }, { data: outline }, { data: order }] = await Promise.all([
    supabase.from('profiles').select('first_name, full_name').eq('id', user!.id).maybeSingle(),
    supabase.from('course_onboarding').select('answers').eq('user_id', user!.id).eq('product_id', product.id).maybeSingle(),
    supabase.rpc('course_outline', { p_product_id: product.id }),
    supabase.from('orders').select('customer_name').eq('user_id', user!.id).not('customer_name', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const rows = (outline ?? []) as { section: string | null; duration_seconds: number | null }[]
  const modules = [...new Set(rows.map((r) => r.section).filter(Boolean))] as string[]
  const videoMinutes = Math.round(rows.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / 60)
  // Le prénom est déjà connu (compte ou commande) : on ne le redemande pas.
  const firstName = profile?.first_name || profile?.full_name?.split(' ')[0] || order?.customer_name?.split(' ')[0] || ''

  return (
    <OnboardingFlow
      slug={product.slug}
      courseTitle={product.title}
      initial={(saved?.answers as Answers | undefined) ?? {}}
      knownName={firstName}
      stats={{ modules: modules.length, lessons: rows.length, videoMinutes }}
    />
  )
}
