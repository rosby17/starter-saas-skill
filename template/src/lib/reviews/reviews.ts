import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PublicReview = { id: string; rating: number; title: string; body: string; progress: number; created_at: string; author: string; avatar: string | null; city: string | null; postId: string | null }
export type ReviewStats = { enrolled: number; reviews: number; rate: number; average: number; positive: number; neutral: number; negative: number; distribution: number[] }

/** Peut-il donner son avis ? Achat réel (accès à vie, pas un essai) ET au moins une leçon terminée. */
export async function reviewEligibility(db: SupabaseClient, userId: string, productId: string): Promise<{ ok: boolean; reason?: string; progress: number }> {
  const [{ data: ent }, { data: lessons }] = await Promise.all([
    db.from('entitlements').select('source').eq('user_id', userId).eq('product_id', productId).is('revoked_at', null).is('expires_at', null).maybeSingle(),
    db.from('lessons').select('id').eq('product_id', productId),
  ])
  if (!ent || ent.source === 'trial') return { ok: false, reason: 'Seuls les élèves inscrits à cette formation peuvent donner leur avis.', progress: 0 }
  const ids = (lessons ?? []).map((l) => l.id)
  if (!ids.length) return { ok: true, progress: 0 }
  const { count } = await db.from('lesson_progress').select('lesson_id', { count: 'exact', head: true }).eq('user_id', userId).in('lesson_id', ids)
  const progress = Math.round(((count ?? 0) / ids.length) * 100)
  if (!count) return { ok: false, reason: 'Termine au moins une leçon pour pouvoir donner ton avis.', progress }
  return { ok: true, progress }
}

/** Chiffres honnêtes : élèves inscrits, avis donnés, taux de réponse, moyenne, positifs / neutres / négatifs. */
export async function reviewStats(db: SupabaseClient, productId: string): Promise<ReviewStats> {
  const [{ count: enrolled }, { data: rows }] = await Promise.all([
    db.from('entitlements').select('id', { count: 'exact', head: true }).eq('product_id', productId).is('revoked_at', null).is('expires_at', null).neq('source', 'trial'),
    db.from('course_reviews').select('rating').eq('product_id', productId).eq('hidden', false),
  ])
  const ratings = (rows ?? []).map((r) => r.rating as number)
  const n = ratings.length
  const distribution = [5, 4, 3, 2, 1].map((s) => ratings.filter((r) => r === s).length)
  return {
    enrolled: enrolled ?? 0, reviews: n, rate: enrolled ? Math.round((n / enrolled) * 100) : 0,
    average: n ? Math.round((ratings.reduce((a, b) => a + b, 0) / n) * 10) / 10 : 0,
    positive: ratings.filter((r) => r >= 4).length, neutral: ratings.filter((r) => r === 3).length, negative: ratings.filter((r) => r <= 2).length,
    distribution,
  }
}

export async function listReviews(db: SupabaseClient, productId: string, limit = 30): Promise<PublicReview[]> {
  const { data: rows } = await db.from('course_reviews').select('id, user_id, rating, title, body, progress_pct, created_at, community_post_id')
    .eq('product_id', productId).eq('hidden', false).order('created_at', { ascending: false }).limit(limit)
  const ids = [...new Set((rows ?? []).map((r) => r.user_id))]
  const { data: profiles } = ids.length ? await db.from('profiles').select('id, full_name, first_name, avatar_url, country').in('id', ids) : { data: [] }
  const who = new Map((profiles ?? []).map((p) => [p.id, p]))
  return (rows ?? []).map((r) => {
    const p = who.get(r.user_id)
    return { id: r.id, rating: r.rating, title: r.title, body: r.body, progress: r.progress_pct, created_at: r.created_at,
      author: publicName(p?.full_name || p?.first_name), avatar: p?.avatar_url ?? null, city: p?.country ?? null, postId: r.community_post_id ?? null }
  })
}

export type StudentProject = { id: string; author: string; title: string; description: string; video: string; poster: string | null; aspect: string; reviewId: string | null }

/** Projets d'élèves visibles d'une formation (ceux d'un avis masqué restent masqués). Vidéos privées : liens signés de 6 h. */
export async function listProjects(db: SupabaseClient, productId: string, limit = 24): Promise<StudentProject[]> {
  const { data: rows, error } = await db.from('student_projects')
    .select('id, user_id, review_id, author_name, title, description, video_url, video_path, poster_url, aspect, course_reviews(hidden)')
    .eq('product_id', productId).eq('hidden', false).order('position').order('created_at', { ascending: false }).limit(limit)
  if (error || !rows) return []
  const visible = rows.filter((r) => {
    const rv = r.course_reviews as { hidden: boolean } | { hidden: boolean }[] | null
    return !(Array.isArray(rv) ? rv[0]?.hidden : rv?.hidden)
  })
  const paths = visible.map((r) => r.video_path).filter(Boolean) as string[]
  const signed = new Map<string, string>()
  if (paths.length) {
    const { data } = await db.storage.from('community').createSignedUrls(paths, 6 * 3600)
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }
  const ids = [...new Set(visible.map((r) => r.user_id).filter(Boolean))] as string[]
  const { data: profiles } = ids.length ? await db.from('profiles').select('id, full_name, first_name').in('id', ids) : { data: [] }
  const who = new Map((profiles ?? []).map((p) => [p.id, publicName(p.full_name || p.first_name)]))
  return visible.map((r) => ({
    id: r.id, title: r.title, description: r.description, poster: r.poster_url, aspect: r.aspect, reviewId: r.review_id,
    author: (r.user_id && who.get(r.user_id)) || r.author_name || 'Élève',
    video: r.video_url || signed.get(r.video_path!) || '',
  })).filter((p) => p.video)
}

/** Prénom et initiale du nom seulement : l'avis est public. */
export function publicName(full: string | null | undefined): string {
  const parts = String(full || 'Élève').trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]
}
