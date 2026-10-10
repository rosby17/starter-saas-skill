import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

type OwnedProductInfo = {
  id: string; slug: string; title: string; subtitle: string | null; image: string | null; category: string
  request_kind: string | null; external_url: string | null
  billing: 'one_time' | 'monthly'; covers_all: boolean; updates_for: string | null
}

export type OwnedProduct = {
  entitlementId: string
  grantedAt: string
  /** null = à vie ; sinon fin de l'abonnement (dépassée = expiré, à renouveler) */
  expiresAt: string | null
  /** Essai gratuit (offre de lancement) : accès limité dans le temps à un cours. */
  trial?: boolean
  active: boolean
  product: OwnedProductInfo
}

const PRODUCT_FIELDS = 'id, slug, title, subtitle, image, category, request_kind, external_url, billing, covers_all, updates_for'

/**
 * Produits du client connecté (lecture avec SA session : la RLS filtre) : ses achats à vie, ses abonnements
 * (actifs ou expirés, pour proposer le renouvellement). L'abonnement « Rester à jour » n'ouvre pas d'autres cours.
 */
export async function getOwnedProducts(supabase: SupabaseClient, userId: string): Promise<OwnedProduct[]> {
  const { data } = await supabase
    .from('entitlements')
    .select(`id, created_at, expires_at, source, product:products(${PRODUCT_FIELDS})`)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
  const now = Date.now()
  const owned: OwnedProduct[] = (data ?? [])
    .filter((row) => row.product)
    .map((row) => ({
      entitlementId: row.id,
      grantedAt: row.created_at,
      expiresAt: row.expires_at,
      trial: row.source === 'trial',
      active: !row.expires_at || new Date(row.expires_at).getTime() > now,
      product: row.product as unknown as OwnedProductInfo,
    }))

  return owned
}

/** Le client connecté a-t-il accès à ce produit ? (achat à vie, abonnement actif, ou super abonnement pour un cours) */
export async function hasProductAccess(supabase: SupabaseClient, _userId: string, productId: string): Promise<boolean> {
  const { data } = await supabase.rpc('has_access', { p_product_id: productId })
  return data === true
}

export type CourseSubscription = {
  /** Abonnement aux mises à jour de CE cours (à vendre / renouveler), s'il existe */
  offer: { slug: string; title: string; price_fcfa: number | null } | null
  /** Fin de l'abonnement du cours (null = jamais abonné) */
  courseUntil: string | null
  /** Fin du super abonnement (null = pas abonné) */
  platformUntil: string | null
  platformOffer: { slug: string; price_fcfa: number | null } | null
}

/** État des abonnements utiles à un cours (bandeau « Mises à jour » et bouton Renouveler). */
export async function getCourseSubscription(supabase: SupabaseClient, userId: string, courseSlug: string): Promise<CourseSubscription> {
  const [{ data: offers }, { data: ents }] = await Promise.all([
    supabase.from('products').select('id, slug, title, price_fcfa, covers_all, updates_for').eq('billing', 'monthly').eq('published', true),
    supabase.from('entitlements').select('product_id, expires_at').eq('user_id', userId).is('revoked_at', null).not('expires_at', 'is', null),
  ])
  const course = (offers ?? []).find((o) => o.updates_for === courseSlug) ?? null
  const platform = (offers ?? []).find((o) => o.covers_all) ?? null
  const until = (id?: string) => (id ? (ents ?? []).find((e) => e.product_id === id)?.expires_at ?? null : null)
  return {
    offer: course ? { slug: course.slug, title: course.title, price_fcfa: course.price_fcfa } : null,
    courseUntil: until(course?.id),
    platformUntil: until(platform?.id),
    platformOffer: platform ? { slug: platform.slug, price_fcfa: platform.price_fcfa } : null,
  }
}
