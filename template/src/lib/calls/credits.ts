import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CALL_SLUG } from './slots'

/** Appels payés (une commande payée = un appel) et appels encore à réserver pour ce client. */
export async function callCredits(db: SupabaseClient, userId: string) {
  const { data: product } = await db.from('products').select('id, title').eq('slug', CALL_SLUG).maybeSingle()
  if (!product) return { product: null, paid: 0, used: 0, left: 0 }
  const [{ count: paid }, { count: used }, { data: granted }] = await Promise.all([
    db.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('product_id', product.id).eq('status', 'success'),
    db.from('call_bookings').select('id', { count: 'exact', head: true }).eq('user_id', userId).neq('status', 'cancelled'),
    db.from('entitlements').select('id').eq('user_id', userId).eq('product_id', product.id).is('revoked_at', null).maybeSingle(),
  ])
  // Accès donné à la main par l'admin sans commande : compte pour un appel.
  const total = Math.max(paid ?? 0, granted ? 1 : 0)
  return { product, paid: total, used: used ?? 0, left: Math.max(0, total - (used ?? 0)) }
}
