import type { Metadata } from 'next'
import { serviceClient } from '@/lib/auth/service-client'
import { ReviewsAdmin, type AdminReview } from './ReviewsAdmin'
import { requireModule } from '@/lib/modules'

export const metadata: Metadata = { title: 'Avis des formations' }
export const dynamic = 'force-dynamic'

// Avis vérifiés : tous publiés d'office. Ici, seulement masquer un avis extrême (avec un motif), ou le réafficher.
export default async function AdminReviewsPage() {
  requireModule('avis')
  const db = serviceClient()
  const { data: rows } = await db.from('course_reviews').select('id, user_id, product_id, rating, title, body, progress_pct, hidden, hidden_reason, created_at').order('created_at', { ascending: false }).limit(300)
  const [{ data: products }, { data: profiles }] = await Promise.all([
    db.from('products').select('id, title'),
    db.from('profiles').select('id, full_name, email').in('id', [...new Set((rows ?? []).map((r) => r.user_id))].concat('00000000-0000-0000-0000-000000000000')),
  ])
  const title = new Map((products ?? []).map((p) => [p.id, p.title]))
  const who = new Map((profiles ?? []).map((p) => [p.id, p]))
  const reviews: AdminReview[] = (rows ?? []).map((r) => ({ ...r, product: title.get(r.product_id) ?? '—', author: who.get(r.user_id)?.full_name || who.get(r.user_id)?.email || '—' }))
  const avg = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1).replace('.', ',') : '—'
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="text-3xl md:text-4xl">Avis des formations</h1>
        <p className="mt-1 text-sm text-gray-500">{reviews.length} avis · moyenne {avg} / 5. Chaque avis est publié automatiquement, sans filtre. Masque seulement un avis extrême (insultes, propos illégaux) : le motif est gardé dans le journal.</p>
      </header>
      <ReviewsAdmin reviews={reviews} />
    </main>
  )
}
