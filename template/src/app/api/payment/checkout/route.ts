import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/auth/service-client'
import { getGateway } from '@/lib/payments/gateways'
import { PAYMENT_PROVIDERS } from '@/lib/payments/providers'
import type { PaymentGateway } from '@/lib/payments/types'
import { getActivePaymentProvider, isPaymentCategoryEnabled } from '@/lib/payments/settings'
import { GatewayError } from '@/lib/payments/types'
import { publicOrigin } from '@/lib/site-url'
import { toFcfa, toUsd } from '@/lib/currency'
import { regionalPrice, zoneForCountry } from '@/lib/pricing/zones'
import { visitorCountry } from '@/lib/pricing/server'
import { checkRateLimit, clientIp } from '@/lib/rate-limit'
import { contactSchema, findOrCreateCustomer } from '@/lib/customers'
import { PRODUCT_COLUMNS, currentPrice, isBuyable, preorderBalance, preorderDeposit, type Product } from '@/lib/catalog/types'
import { setOrderCookie } from '@/lib/orders/order-cookie'
import { CALL_SLUG } from '@/lib/calls/slots'
import { COMMUNITY_SLUG } from '@/lib/catalog/slugs'

const bodySchema = contactSchema.extend({
  productSlug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  paymentType: z.enum(['mobile_money', 'wave', 'card', 'paypal', 'crypto']).default('mobile_money'),
})

/**
 * Achat d'un produit, AVEC OU SANS compte :
 *  1. coordonnées obligatoires (nom, e-mail, WhatsApp) → le compte est retrouvé ou créé, le profil complété ;
 *     un client connecté achète toujours pour SON compte (l'e-mail de la session prime sur celui du formulaire) ;
 *  2. le prix vient du catalogue en base (promo comprise), jamais du navigateur, puis est adapté à la zone du
 *     visiteur détectée par le serveur (Europe, Amériques : lib/pricing/zones.ts) ;
 *  3. la passerelle est celle que l'administrateur a activée pour le type de paiement choisi (/admin/payment-providers) ;
 *  4. la commande « pending » garde les coordonnées du client ; un cookie signé lie ce navigateur à la commande.
 */
export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    if (!checkRateLimit(`checkout:${ip}`, 8, 60_000).success) {
      return NextResponse.json({ success: false, message: 'Trop de tentatives. Réessaie dans une minute.' }, { status: 429 })
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || 'Formulaire incomplet.' }, { status: 400 })
    }
    const input = parsed.data
    if (!checkRateLimit(`checkout:${input.email}`, 5, 10 * 60_000).success) {
      return NextResponse.json({ success: false, message: 'Trop de tentatives pour cette adresse. Réessaie dans quelques minutes.' }, { status: 429 })
    }

    const db = serviceClient()
    const { data: productRow } = await db.from('products').select(PRODUCT_COLUMNS).eq('slug', input.productSlug).eq('published', true).maybeSingle()
    const product = productRow as Product | null
    if (!product || !isBuyable(product)) {
      return NextResponse.json({ success: false, message: 'Ce produit ne se paie pas en ligne : fais une demande depuis sa page.' }, { status: 400 })
    }
    const basePrice = currentPrice(product)!

    // La passerelle active d'abord, puis les autres passerelles configurées du même type en secours :
    // si l'une refuse (clé expirée, panne), le client passe par l'autre sans rien voir.
    if (!(await isPaymentCategoryEnabled(db, input.paymentType))) {
      return NextResponse.json({ success: false, message: 'Ce moyen de paiement n’est plus proposé. Choisis-en un autre.' }, { status: 400 })
    }
    const providerId = await getActivePaymentProvider(db, input.paymentType)
    const gateways = [providerId, ...PAYMENT_PROVIDERS[input.paymentType].map((p) => p.id).filter((id) => id !== providerId)]
      .map(getGateway).filter((g): g is PaymentGateway => !!g && g.isConfigured())
    if (!gateways.length) {
      console.error(`Paiement indisponible : passerelle "${providerId}" absente ou mal configurée.`)
      return NextResponse.json({ success: false, message: 'Ce moyen de paiement est momentanément indisponible. Choisis-en un autre ou réessaie plus tard.' }, { status: 503 })
    }

    // Identité : la session si le client est connecté, sinon le compte de l'e-mail saisi (créé au besoin).
    const { data: { user } } = await (await createClient()).auth.getUser()
    let userId: string
    let newAccount = false
    let email = input.email
    if (user?.email) {
      userId = user.id
      email = user.email
      // Compléter le profil (WhatsApp, pays) s'il manquait : le prochain achat se fera sans rien saisir.
      const { data: prof } = await db.from('profiles').select('phone, country, full_name').eq('id', user.id).maybeSingle()
      const patch: Record<string, string> = {}
      if (!prof?.phone && input.phone) patch.phone = input.phone
      if (!prof?.country && input.country) patch.country = input.country
      if (!prof?.full_name && input.fullName) patch.full_name = input.fullName
      if (Object.keys(patch).length) await db.from('profiles').update(patch).eq('id', user.id)
    } else {
      const customer = await findOrCreateCustomer(db, input)
      userId = customer.userId
      newAccount = customer.created
    }

    // Précommande (offre pas encore prête) : réservation de 10 %. Formation sortie et place réservée : solde de 60 %.
    let purchaseKind: 'full' | 'deposit' | 'balance' = 'full'
    let price = basePrice
    let planName = product.title

    if (product.billing === 'monthly') {
      // Communauté : déjà incluse avec une formation, un accompagnement ou le Pro. Inutile de la payer.
      if (product.slug === COMMUNITY_SLUG) {
        const { data: ents } = await db.from('entitlements').select('expires_at, products(category, covers_all)').eq('user_id', userId).is('revoked_at', null)
        const included = ((ents ?? []) as { expires_at: string | null; products: { category: string; covers_all: boolean } | { category: string; covers_all: boolean }[] | null }[]).some((e) => {
          const p = Array.isArray(e.products) ? e.products[0] : e.products
          return (!e.expires_at && (p?.category === 'formation' || p?.category === 'accompagnement')) || (!!p?.covers_all && !!e.expires_at && new Date(e.expires_at).getTime() > Date.now())
        })
        if (included) return NextResponse.json({ success: false, alreadyOwned: true, message: 'Tu as déjà accès à la communauté grâce à ta formation ou à ton Pro : ouvre-la depuis ton espace.' }, { status: 409 })
      }
      // Abonnement : se renouvelle en le repayant (le temps restant s'ajoute). Celui d'un cours est réservé à ses acheteurs.
      if (product.updates_for) {
        const { data: course } = await db.from('products').select('id, title').eq('slug', product.updates_for).maybeSingle()
        const { data: owns } = course
          ? await db.from('entitlements').select('id').eq('user_id', userId).eq('product_id', course.id).is('revoked_at', null).is('expires_at', null).maybeSingle()
          : { data: null }
        if (!owns) {
          return NextResponse.json({ success: false, message: `Cet abonnement donne les mises à jour de « ${course?.title ?? 'la formation'} » : achète d'abord la formation (son 1er mois d'abonnement est inclus).` }, { status: 409 })
        }
      }
      // Pro (« Rester à jour » de ses formations) : réservé à ceux qui ont déjà au moins une formation à vie.
      if (product.covers_all) {
        const { data: ents } = await db.from('entitlements').select('products(category, billing)').eq('user_id', userId).is('revoked_at', null).is('expires_at', null)
        const ownsCourse = ((ents ?? []) as { products: { category: string; billing: string } | { category: string; billing: string }[] | null }[])
          .some((e) => { const p = Array.isArray(e.products) ? e.products[0] : e.products; return p?.category === 'formation' && p.billing !== 'monthly' })
        if (!ownsCourse) {
          return NextResponse.json({ success: false, message: 'Le Pro garde à jour tes formations : commence par une formation, puis passe en Pro pour recevoir toutes ses nouveautés.' }, { status: 409 })
        }
      }
    } else {
      // Achat à vie déjà fait : inutile de payer deux fois (sauf l'heure d'appel et les crédits : ils se rachètent).
      const { data: already } = product.slug === CALL_SLUG || product.category === 'credits' ? { data: null } : await db.from('entitlements').select('id').eq('user_id', userId).eq('product_id', product.id).is('revoked_at', null).is('expires_at', null).maybeSingle()
      if (already) {
        return NextResponse.json({ success: false, alreadyOwned: true, message: 'Tu as déjà accès à ce produit. Connecte-toi pour le retrouver dans « Formations ».' }, { status: 409 })
      }
      const { data: reservation } = await db.from('preorders').select('status').eq('user_id', userId).eq('product_id', product.id).neq('status', 'cancelled').maybeSingle()
      if (product.preorder) {
        if (reservation) {
          return NextResponse.json({ success: false, alreadyOwned: true, message: 'Ta place est déjà réservée : tu seras prévenu le premier dès la sortie de la formation.' }, { status: 409 })
        }
        purchaseKind = 'deposit'
        price = preorderDeposit(basePrice)
        planName = `Réservation · ${product.title}`
      } else if (reservation?.status === 'reserved') {
        purchaseKind = 'balance'
        price = preorderBalance(basePrice)
        planName = `Solde · ${product.title}`
      }
    }

    // Prix de la zone du visiteur (FCFA en Afrique et en Asie, € en Europe, $ dans les Amériques).
    // Les passerelles africaines facturent en FCFA : on leur passe l'équivalent exact du prix affiché.
    // Mobile Money : TOUJOURS le prix FCFA. Seul un compte Mobile Money africain peut payer ainsi ; un VPN ou un relais
    // privé (adresse vue en Amérique ou en Europe) ne doit pas faire payer un client africain en dollars ou en euros.
    const ipCountry = await visitorCountry(request)
    const regional = input.paymentType === 'mobile_money' ? { amount: price, currency: 'XAF' as const } : regionalPrice(price, ipCountry)
    const priceZone = input.paymentType === 'mobile_money' ? 'mobile_money_fcfa' : zoneForCountry(ipCountry)
    const fcfaLike = regional.currency === 'XAF' || regional.currency === 'XOF'
    const amountFcfa = fcfaLike ? price : await toFcfa(regional.amount, regional.currency)
    const amountUsd = regional.currency === 'USD' ? regional.amount : await toUsd(amountFcfa, 'XOF')
    const orderCurrency = fcfaLike ? 'XOF' : regional.currency
    const generatedId = crypto.randomUUID()
    const [firstName, ...rest] = input.fullName.split(/\s+/)
    let gateway = gateways[0]
    let created: Awaited<ReturnType<PaymentGateway['createCheckout']>> | null = null
    let lastError: unknown = null
    for (const g of gateways) {
      try {
        created = await g.createCheckout({
          orderId: generatedId,
          plan: { id: product.slug, name: planName, amountLocal: fcfaLike ? price : regional.amount, amountUsd },
          currency: orderCurrency,
          customer: { email, firstName, lastName: rest.join(' '), phone: input.phone },
          origin: publicOrigin(),
          amountFcfa,
          paymentType: input.paymentType,
        })
        gateway = g
        break
      } catch (error) {
        console.error(`Passerelle ${g.id} indisponible, essai de la suivante :`, error instanceof Error ? error.message : error)
        lastError = error
      }
    }
    if (!created) throw lastError
    const orderId = created.orderId || generatedId

    const { error } = await db.from('orders').insert({
      id: orderId,
      user_id: userId,
      product_id: product.id,
      plan_name: planName,
      purchase_kind: purchaseKind,
      // Pack de crédits : versés par credit_paid_order au paiement confirmé, avec leur date de fin.
      credits: product.category === 'credits' ? product.credits : 0,
      validity_days: product.category === 'credits' ? product.credits_validity_days : null,
      amount_local: fcfaLike ? price : regional.amount,
      amount_fcfa: amountFcfa,
      amount_usd: amountUsd,
      currency: orderCurrency,
      payment_method: gateway.paymentMethod,
      payment_ref: created.providerRef,
      status: 'pending',
      customer_name: input.fullName,
      customer_email: email,
      customer_phone: input.phone,
      customer_country: input.country || null,
      // Journal : ce que le serveur a vu (adresse IP, pays déduit) et la zone de prix appliquée.
      client_ip: ip !== 'inconnue' ? ip : null,
      ip_country: ipCountry || null,
      price_zone: priceZone,
      new_account: newAccount,
    })
    if (error) {
      // Sans commande en base, un paiement ne pourrait jamais être livré : on n'envoie pas le client payer.
      console.error('Commande « pending » non enregistrée :', error)
      return NextResponse.json({ success: false, message: 'Le service est momentanément indisponible. Réessaie dans un instant.' }, { status: 500 })
    }
    await setOrderCookie(orderId)

    // redirectUrl absent = paiement manuel (Binance) : le client reçoit des instructions et la référence à indiquer.
    return NextResponse.json({ success: true, cartId: orderId, redirectUrl: created.redirectUrl ?? null, manual: created.manual ?? null })
  } catch (error) {
    if (error instanceof GatewayError) return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    console.error('Erreur checkout :', error)
    return NextResponse.json({ success: false, message: 'Le service est momentanément indisponible. Réessaie dans un instant.' }, { status: 500 })
  }
}
