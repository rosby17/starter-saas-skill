import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/brevo'
import { courseUpdateTemplate } from '@/lib/email/templates'
import { publicOrigin } from '@/lib/site-url'

/**
 * Annonce une nouveauté d'une formation (nouveau module, nouvelle leçon…) à TOUS ceux qui y ont accès :
 * acheteurs à vie et abonnés Pro en cours. Une notification dans leur espace + un e-mail (si demandé).
 */
export async function announceToCourse(db: SupabaseClient, productId: string, msg: { title: string; body?: string | null; url: string; email: boolean }) {
  const now = new Date().toISOString()
  const [{ data: owners }, { data: pro }] = await Promise.all([
    db.from('entitlements').select('user_id').eq('product_id', productId).is('revoked_at', null).is('expires_at', null),
    db.from('entitlements').select('user_id, products!inner(covers_all)').eq('products.covers_all', true).is('revoked_at', null).gt('expires_at', now),
  ])
  const users = [...new Set([...(owners ?? []), ...(pro ?? [])].map((e) => e.user_id as string))]
  if (!users.length) return { notified: 0, emailed: 0 }

  const { error } = await db.from('notifications').insert(users.map((user_id) => ({ user_id, product_id: productId, title: msg.title, body: msg.body || null, url: msg.url })))
  if (error) throw new Error(`Notifications non écrites : ${error.message}`)

  let emailed = 0
  if (msg.email) {
    const { data: profiles } = await db.from('profiles').select('id, email, first_name').in('id', users)
    for (const p of profiles ?? []) {
      if (!p.email) continue
      const ok = await sendEmail({
        to: { email: p.email, name: p.first_name || undefined },
        subject: `✨ Nouveau dans ta formation : ${msg.title}`,
        html: courseUpdateTemplate({ name: p.first_name, title: msg.title, body: msg.body, url: `${publicOrigin()}${msg.url}` }),
        priority: 'normal',
      })
      if (ok) emailed++
    }
  }
  return { notified: users.length, emailed }
}

/** Prévient les élèves qui ont RÉSERVÉ une formation en précommande (elle vient de sortir). */
export async function announceToReservations(db: SupabaseClient, productId: string, msg: { title: string; body: string; url: string }) {
  const { data } = await db.from('preorders').select('user_id').eq('product_id', productId).eq('status', 'reserved')
  const users = [...new Set((data ?? []).map((r) => r.user_id as string))]
  if (!users.length) return { notified: 0, emailed: 0 }
  await db.from('notifications').insert(users.map((user_id) => ({ user_id, product_id: productId, ...msg })))
  const { data: profiles } = await db.from('profiles').select('id, email, first_name').in('id', users)
  let emailed = 0
  for (const p of profiles ?? []) {
    if (!p.email) continue
    if (await sendEmail({ to: { email: p.email, name: p.first_name || undefined }, subject: `🎉 ${msg.title}`, html: courseUpdateTemplate({ name: p.first_name, title: msg.title, body: msg.body, url: `${publicOrigin()}${msg.url}` }), priority: 'high' })) emailed++
  }
  return { notified: users.length, emailed }
}
