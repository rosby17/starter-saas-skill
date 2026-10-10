import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/brevo'
import { courseUpdateTemplate } from '@/lib/email/templates'
import { publicOrigin } from '@/lib/site-url'

/** Prévient le client d'un changement sur son appel : cloche + e-mail (jamais d'erreur levée). */
export async function notifyCallClient(db: SupabaseClient, userId: string, productId: string, title: string, body: string) {
  try {
    await db.from('notifications').insert({ user_id: userId, product_id: productId, title, body, url: '/appels' })
    const { data: u } = await db.auth.admin.getUserById(userId)
    const { data: p } = await db.from('profiles').select('first_name, full_name').eq('id', userId).maybeSingle()
    if (u?.user?.email) {
      await sendEmail({ to: { email: u.user.email, name: p?.full_name || undefined }, subject: title, html: courseUpdateTemplate({ name: p?.first_name, title, body, url: `${publicOrigin()}/appels` }), priority: 'high' })
    }
  } catch (e) {
    console.error('Notification d’appel non envoyée :', e)
  }
}
