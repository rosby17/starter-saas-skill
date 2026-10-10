import 'server-only'
import { unstable_cache } from 'next/cache'
import { serviceClient } from '@/lib/auth/service-client'
import { PRODUCT_COLUMNS, type Product } from './types'

// Lecture du catalogue côté serveur. Clé service + filtre « published » explicite : les pages publiques
// ne dépendent pas de la session du visiteur. Mis en cache 60 s, vidé à chaque modification dans l'admin
// (revalidateTag(CATALOG_TAG)).
export const CATALOG_TAG = 'catalog'

const supabaseReady = () => /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL || '') && !!process.env.SUPABASE_SERVICE_ROLE_KEY

const loadPublished = unstable_cache(
  async (): Promise<Product[]> => {
    const { data, error } = await serviceClient().from('products').select(PRODUCT_COLUMNS).eq('published', true).order('position')
    if (error) throw new Error(error.message) // une erreur n'est jamais mise en cache
    return (data ?? []) as Product[]
  },
  ['published-products'],
  { tags: [CATALOG_TAG], revalidate: 60 }
)

export async function getPublishedProducts(): Promise<Product[]> {
  if (!supabaseReady()) return []
  try {
    return await loadPublished()
  } catch (error) {
    console.error('Catalogue illisible :', error)
    return []
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null
  return (await getPublishedProducts()).find((p) => p.slug === slug) ?? null
}

/** Titres des leçons d'un produit (programme affiché sur la page de vente, sans les vidéos). */
export async function getLessonOutline(productId: string): Promise<Array<{ section: string | null; title: string; summary: string | null; duration_seconds: number | null }>> {
  if (!supabaseReady()) return []
  // Programme visible avant l'achat : titres, modules, objectifs. Jamais le contenu des leçons ni les vidéos.
  const { data } = await serviceClient().from('lessons').select('section, title, summary, duration_seconds').eq('product_id', productId).order('position')
  return data ?? []
}
