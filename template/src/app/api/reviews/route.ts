import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { checkRateLimit } from '@/lib/rate-limit'
import { reviewEligibility } from '@/lib/reviews/reviews'
import { notifyAdmin } from '@/lib/orders/deliver'

// Donner (ou modifier) son avis sur une formation. Vérifié : achat réel + au moins une leçon terminée.
// Publié tout de suite, sans filtre ; aussi posté dans le groupe « Avis des élèves » de la communauté (une fois).
const schema = z.object({
  productSlug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).default(''),
  body: z.string().trim().min(10, 'Écris au moins une phrase (10 caractères).').max(2000),
  // Vidéo du projet de l'élève, déjà envoyée via /api/reviews/upload-url (facultatif).
  project: z.object({ path: z.string().max(300), title: z.string().trim().max(120).default(''), aspect: z.enum(['16/9', '1/1', '9/16', '4/5']).default('16/9') }).optional(),
})
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, message: 'Connecte-toi.' }, { status: 401 })
  if (!checkRateLimit(`review:${user.id}`, 10, 60 * 60_000).success) return NextResponse.json({ success: false, message: 'Réessaie plus tard.' }, { status: 429 })
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? 'Avis invalide.' }, { status: 400 })
  const d = parsed.data
  const db = serviceClient()
  const { data: product } = await db.from('products').select('id, title').eq('slug', d.productSlug).maybeSingle()
  if (!product) return NextResponse.json({ success: false, message: 'Formation introuvable.' }, { status: 404 })
  const can = await reviewEligibility(db, user.id, product.id)
  if (!can.ok) return NextResponse.json({ success: false, message: can.reason }, { status: 403 })
  if (d.project && (!d.project.path.startsWith(`${user.id}/projet-`) || d.project.path.includes('..'))) return NextResponse.json({ success: false, message: 'Vidéo invalide.' }, { status: 400 })
  const { data: before } = await db.from('course_reviews').select('id, community_post_id').eq('user_id', user.id).eq('product_id', product.id).maybeSingle()
  const { data: saved, error } = await db.from('course_reviews').upsert({ user_id: user.id, product_id: product.id, rating: d.rating, title: d.title, body: d.body, progress_pct: can.progress, updated_at: new Date().toISOString() }, { onConflict: 'user_id,product_id' }).select('id').single()
  if (error || !saved) return NextResponse.json({ success: false, message: 'Avis non enregistré.' }, { status: 500 })

  // Projet joint : un seul par avis (le nouveau remplace l'ancien).
  const { data: oldProject } = await db.from('student_projects').select('video_path').eq('review_id', saved.id).maybeSingle()
  const newProject = !!d.project && d.project.path !== oldProject?.video_path
  if (d.project && newProject) {
    await db.from('student_projects').upsert({ review_id: saved.id, user_id: user.id, product_id: product.id, title: d.project.title || d.title, video_path: d.project.path, video_url: null, aspect: d.project.aspect, hidden: false }, { onConflict: 'review_id' })
  }

  // Dans le groupe « Avis des élèves » (ouvert à la discussion) : le premier avis, puis chaque nouveau projet.
  const media = d.project && newProject ? [{ path: d.project.path, type: 'video', name: d.project.title || 'Mon projet' }] : []
  if (!before || media.length) {
    const { data: channel } = await db.from('community_channels').select('id').eq('slug', 'avis').maybeSingle()
    if (channel) {
      const text = !before
        ? `${stars(d.rating)} · ${product.title}${d.title ? `\n${d.title}` : ''}\n\n${d.body}\n\n✔ Achat vérifié · a suivi ${can.progress} % de la formation${media.length ? '\n🎬 Mon projet réalisé avec la formation ⬆' : ''}`
        : `🎬 Mon projet réalisé avec « ${product.title} »${d.project?.title ? ` : ${d.project.title}` : ''}`
      const { data: post } = await db.from('community_posts').insert({ channel_id: channel.id, author_id: user.id, kind: 'post', body: text, media }).select('id').single()
      if (post && !before?.community_post_id) await db.from('course_reviews').update({ community_post_id: post.id }).eq('id', saved.id)
    }
  }
  if (!before) await notifyAdmin(`⭐ Nouvel avis (${d.rating}/5) : ${product.title}`, [d.title, d.body.slice(0, 500), media.length ? '🎬 Avec la vidéo de son projet' : ''].filter(Boolean), '/admin/avis-formations')
  return NextResponse.json({ success: true, message: before ? 'Ton avis est mis à jour.' : 'Merci ! Ton avis est publié.' })
}
