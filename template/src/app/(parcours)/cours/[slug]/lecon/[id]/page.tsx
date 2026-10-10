import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getCourseSubscription, hasProductAccess } from '@/lib/access'
import { parseBlocks } from '@/lib/course/blocks'
import { LessonView, type OutlineItem } from './LessonView'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = { title: 'Leçon', robots: { index: false } }

type Row = { id: string; section: string | null; title: string; summary: string | null; duration_seconds: number | null; unlocked: boolean }

// Une leçon en plein écran, étape par étape. Le contenu est lu avec la session du client (RLS) :
// une leçon verrouillée (nouveauté réservée aux abonnés) n'est jamais envoyée au navigateur.
export default async function LessonPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  requireModule('formations')
  const { slug, id } = await params
  if (!/^[a-z0-9-]{1,80}$/.test(slug) || !/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: product } = await supabase.from('products').select('id, slug, title').eq('slug', slug).maybeSingle()
  if (!product) notFound()
  // Pas (ou plus) d'accès, par exemple essai gratuit terminé : direction la page d'achat.
  if (!(await hasProductAccess(supabase, user!.id, product.id))) redirect(`/dashboard/offres/${product.slug}`)

  const [{ data: outline }, { data: lesson }, { data: progress }, sub] = await Promise.all([
    supabase.rpc('course_outline', { p_product_id: product.id }),
    supabase.from('lessons').select('id, section, title, summary, description, youtube_url, video_path, duration_seconds, blocks').eq('id', id).eq('product_id', product.id).maybeSingle(),
    supabase.from('lesson_progress').select('lesson_id').eq('user_id', user!.id),
    getCourseSubscription(supabase, user!.id, product.slug),
  ])
  const rows = (outline ?? []) as Row[]
  const current = rows.find((r) => r.id === id)
  if (!current) notFound()

  const items: OutlineItem[] = rows.map((r) => ({ id: r.id, section: r.section, title: r.title, duration: r.duration_seconds, unlocked: r.unlocked }))
  const unlockHref = sub.offer ? `/dashboard/offres/${sub.offer.slug}` : sub.platformOffer ? `/dashboard/offres/${sub.platformOffer.slug}` : '/dashboard/boutique'

  return (
    <LessonView
      slug={product.slug}
      courseTitle={product.title}
      email={user!.email ?? ''}
      outline={items}
      completed={(progress ?? []).map((p) => p.lesson_id)}
      unlockHref={unlockHref}
      lesson={lesson && current.unlocked ? {
        id: lesson.id,
        section: lesson.section,
        title: lesson.title,
        summary: lesson.summary,
        description: lesson.description,
        youtube: lesson.youtube_url,
        hasVideo: !!lesson.video_path,
        duration: lesson.duration_seconds,
        blocks: parseBlocks(lesson.blocks),
      } : { id: current.id, section: current.section, title: current.title, summary: current.summary, description: null, youtube: null, hasVideo: false, duration: current.duration_seconds, blocks: [], locked: true }}
    />
  )
}
