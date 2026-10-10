import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { acquireCronLock, releaseCronLock } from '@/lib/cron-lock'
import { serviceClient } from '@/lib/auth/service-client'
import { sendEmail } from '@/lib/email/brevo'
import { publicOrigin } from '@/lib/site-url'
import { formatFcfa } from '@/lib/catalog/types'
import { signature } from '@/config/site'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

type Row = {
  id: string; user_id: string; expires_at: string; reminded_soon_for: string | null; reminded_expired_for: string | null
  product: { slug: string; title: string; price_fcfa: number | null; covers_all: boolean } | null
}

/**
 * Rappels de renouvellement des abonnements (une fois par jour, Authorization: Bearer $CRON_SECRET) :
 *  · 3 jours avant la fin : « ton abonnement se termine le … » ;
 *  · le jour de la fin (et jusqu'à 7 jours après) : « ton abonnement est terminé, ta formation reste à toi ».
 * Chaque rappel n'est envoyé qu'une fois par date de fin (colonnes reminded_*_for) : un renouvellement repart de zéro.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response('Unauthorized', { status: 401 })
  if (!(await acquireCronLock('subscription-reminders'))) return NextResponse.json({ success: true, skipped: 'already running' })
  const db = serviceClient()
  let sent = 0
  try {
    const now = Date.now()
    const { data, error } = await db
      .from('entitlements')
      .select('id, user_id, expires_at, reminded_soon_for, reminded_expired_for, product:products(slug, title, price_fcfa, covers_all)')
      .is('revoked_at', null)
      .gte('expires_at', new Date(now - 7 * DAY).toISOString())
      .lte('expires_at', new Date(now + 3 * DAY).toISOString())
    if (error) throw error

    for (const row of (data ?? []) as unknown as Row[]) {
      if (!row.product) continue
      const end = new Date(row.expires_at).getTime()
      const expired = end <= now
      if (expired ? row.reminded_expired_for === row.expires_at : row.reminded_soon_for === row.expires_at) continue
      const { data: userData } = await db.auth.admin.getUserById(row.user_id)
      const email = userData?.user?.email
      if (!email) continue
      const { data: profile } = await db.from('profiles').select('first_name, full_name').eq('id', row.user_id).maybeSingle()
      const name = profile?.first_name || profile?.full_name || ''
      const date = new Date(row.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Douala' })
      const renew = `${publicOrigin()}/boutique/${row.product.slug}`
      const price = row.product.price_fcfa ? `${formatFcfa(row.product.price_fcfa)} par mois` : ''
      const what = row.product.covers_all ? 'les nouveautés et mises à jour de toutes tes formations' : 'les nouveaux modules, les nouveautés IA et le support'
      const subject = expired ? `Ton abonnement « ${row.product.title} » est terminé` : `Ton abonnement « ${row.product.title} » se termine le ${date}`
      const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0D0D0D;line-height:1.6">
        <p>Bonjour${name ? ` ${esc(name)}` : ''},</p>
        <p>${expired
          ? `Ton abonnement <strong>${esc(row.product.title)}</strong> s'est terminé le ${date}. Tes formations achetées restent à toi à vie ; l'abonnement débloquait ${what}.`
          : `Ton abonnement <strong>${esc(row.product.title)}</strong> se termine le <strong>${date}</strong>. Il te donne ${what}.`}</p>
        <p>Renouvelle en un clic${price ? ` (${price}, sans engagement)` : ''} : le temps restant s'ajoute, tu ne perds aucun jour.</p>
        <p><a href="${renew}" style="display:inline-block;background:#C8102E;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">${expired ? 'Renouveler mon abonnement' : 'Prolonger mon abonnement'}</a></p>
        <p style="color:#666;font-size:13px">Les formations évoluent : l’abonnement te donne chaque nouveauté dès sa sortie.<br>${esc(signature())}</p>
      </div>`
      const ok = await sendEmail({ to: { email, name: profile?.full_name || undefined }, subject, html, priority: 'high' })
      if (!ok) continue
      await db.from('entitlements').update(expired ? { reminded_expired_for: row.expires_at } : { reminded_soon_for: row.expires_at }).eq('id', row.id)
      sent++
    }
    return NextResponse.json({ success: true, sent })
  } catch (error) {
    console.error('Cron subscription-reminders :', error)
    return NextResponse.json({ success: false, sent, error: 'Rappels impossibles.' }, { status: 500 })
  } finally {
    await releaseCronLock('subscription-reminders')
  }
}
