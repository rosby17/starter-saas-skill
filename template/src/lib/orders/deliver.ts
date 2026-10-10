import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/brevo'
import { accessReadyTemplate, adminAlertTemplate, reservationTemplate } from '@/lib/email/templates'
import { invoicePdf, loadInvoice } from '@/lib/invoices/invoice'
import { createLoginLink, loginPageUrl } from '@/lib/auth/access-link'
import { publicOrigin } from '@/lib/site-url'

/** Titres d'un produit et des produits qu'il inclut (ex. le coaching inclut le replay). */
export async function productTitlesWithIncludes(db: SupabaseClient, productId: string): Promise<string[]> {
  const { data: product } = await db.from('products').select('title, includes').eq('id', productId).maybeSingle()
  if (!product) return []
  const titles = [product.title as string]
  const includes = (product.includes as string[] | null) ?? []
  if (includes.length) {
    const { data: extra } = await db.from('products').select('title').in('slug', includes)
    titles.push(...(extra ?? []).map((p) => p.title as string))
  }
  return titles
}

/**
 * E-mail « Ton accès est prêt » avec un lien de connexion directe. Ne lève jamais d'erreur :
 * l'accès est déjà accordé en base, l'e-mail n'est qu'un moyen de le retrouver (le client peut toujours
 * redemander un lien depuis la page Connexion).
 */
export async function sendAccessEmail(db: SupabaseClient, userId: string, productTitles: string[], amount?: string | null, orderId?: string | null): Promise<boolean> {
  try {
    const { data: userData } = await db.auth.admin.getUserById(userId)
    const email = userData?.user?.email
    if (!email) return false
    const { data: profile } = await db.from('profiles').select('first_name, full_name').eq('id', userId).maybeSingle()
    const loginUrl = (await createLoginLink(db, email, '/mes-achats')) ?? loginPageUrl('/mes-achats')
    // Commande payée : la facture PDF part en pièce jointe (si elle échoue, l'e-mail part quand même).
    const inv = orderId ? await loadInvoice(db, orderId).catch(() => null) : null
    const pdf = inv ? await invoicePdf(inv).catch((e) => { console.error('Facture PDF non générée :', e); return null }) : null
    const attachments = inv && pdf ? [{ name: `${inv.number}.pdf`, content: Buffer.from(pdf).toString('base64') }] : undefined
    const invoice = attachments ? inv!.number : null
    const name = profile?.first_name || profile?.full_name
    if (inv?.kind === 'deposit') {
      return await sendEmail({
        to: { email, name: profile?.full_name || undefined },
        subject: `✅ Ta place est réservée : « ${productTitles[0]} »`,
        html: reservationTemplate({ name, product: productTitles[0], amount, invoice, loginUrl }),
        priority: 'critical', attachments,
      })
    }
    return await sendEmail({
      to: { email, name: profile?.full_name || undefined },
      subject: productTitles.length === 1 ? `🎉 Bienvenue dans « ${productTitles[0]} » : ton accès est prêt` : '🎉 Bienvenue : ton accès est prêt',
      html: accessReadyTemplate({ name, products: productTitles, loginUrl, amount, invoice }),
      priority: 'critical', attachments,
    })
  } catch (error) {
    console.error("E-mail d'accès non envoyé :", error)
    return false
  }
}

/** Prévient l'administrateur (ADMIN_NOTIFY_EMAIL, réglable dans /admin/keys). Silencieux si non configuré. */
export async function notifyAdmin(title: string, lines: string[], path = '/admin'): Promise<void> {
  const to = process.env.ADMIN_NOTIFY_EMAIL
  if (!to) return
  try {
    await sendEmail({ to: { email: to }, subject: title, html: adminAlertTemplate({ title, lines, url: `${publicOrigin()}${path}` }), priority: 'low' })
  } catch (error) {
    console.error('Alerte admin non envoyée :', error)
  }
}
