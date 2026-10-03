import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getPlanById } from '@/lib/pricing'
import { getGateway } from '@/lib/payments/gateways'
import { getActivePaymentProvider } from '@/lib/payments/settings'
import { GatewayError } from '@/lib/payments/types'
import type { PaymentCategoryId } from '@/lib/payments/providers'
import { publicOrigin } from '@/lib/site-url'
import { toFcfa } from '@/lib/currency'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * Crée un lien de paiement et enregistre la commande « pending ».
 *
 * Même flux pour tous les SaaS :
 *  1. l'identité vient de la SESSION, jamais du corps de la requête ;
 *  2. le prix vient du catalogue serveur (pricing.ts), jamais du navigateur ;
 *  3. le client choisit un TYPE de paiement (paymentType) ; la passerelle est celle que
 *     l'administrateur a activée pour ce type (/admin/payment-providers).
 */
// Tout ce qui vient du navigateur est borné : longueurs, formats, valeurs permises. Le prix, lui, vient du catalogue serveur.
const CheckoutBody = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).optional().default(''),
  phone: z.string().trim().regex(/^\+?[0-9 ]{6,20}$/).optional().or(z.literal('')),
  planId: z.string().min(1).max(60),
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
  paymentType: z.enum(['mobile_money', 'card', 'paypal', 'crypto']).catch('mobile_money'),
})

export async function POST(request: Request) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user || !user.email) {
      return NextResponse.json({ success: false, message: 'Connecte-toi pour payer.' }, { status: 401 })
    }

    if (!checkRateLimit(`checkout:${user.id}`, 10, 60_000).success) {
      return NextResponse.json({ success: false, message: 'Trop de tentatives. Réessaie dans une minute.' }, { status: 429 })
    }

    const parsed = CheckoutBody.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Le prénom et le forfait sont obligatoires (téléphone : chiffres uniquement).' }, { status: 400 })
    }
    const { firstName, lastName, phone, planId, currency } = parsed.data
    const paymentType: PaymentCategoryId = parsed.data.paymentType
    const plan = getPlanById(planId)
    if (!plan || plan.amountLocal <= 0) {
      return NextResponse.json({ success: false, message: 'Forfait invalide ou gratuit : aucun paiement à faire.' }, { status: 400 })
    }

    const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const providerId = await getActivePaymentProvider(db, paymentType)
    const gateway = getGateway(providerId)
    if (!gateway || !gateway.isConfigured()) {
      console.error(`Paiement indisponible : passerelle "${providerId}" absente ou mal configurée.`)
      return NextResponse.json({ success: false, message: 'Ce moyen de paiement est momentanément indisponible. Choisis-en un autre ou réessaie plus tard.' }, { status: 503 })
    }

    // Adresse du site fixée côté serveur : jamais l'en-tête Origin de la requête (voir site-url.ts).
    const origin = publicOrigin()
    const paymentCurrency = String(currency || plan.currency || 'XOF').toUpperCase()

    const amountFcfa = await toFcfa(plan.amountLocal, paymentCurrency)
    const generatedId = crypto.randomUUID()
    const created = await gateway.createCheckout({
      orderId: generatedId,
      plan,
      currency: paymentCurrency,
      customer: { email: user.email, firstName: String(firstName), lastName: String(lastName || ''), phone: phone ? String(phone).trim() : undefined },
      origin,
      amountFcfa,
      paymentType,
    })
    // Jamais providerRef : certaines passerelles renvoient une référence qui n'est pas un UUID (GeniusPay, Binance).
    const orderId = created.orderId || generatedId

    const { error } = await db.from('orders').insert({
      id: orderId,
      user_id: user.id,
      plan_name: plan.name,
      credits: plan.credits,
      amount_local: plan.amountLocal,
      amount_fcfa: amountFcfa,
      amount_usd: plan.amountUsd,
      validity_days: plan.validityDays ?? null,
      currency: paymentCurrency,
      payment_method: gateway.paymentMethod,
      payment_ref: created.providerRef,
      status: 'pending',
    })
    if (error) {
      // Sans commande en base, un paiement ne pourrait jamais être crédité : on n'envoie pas le client payer.
      console.error('Commande « pending » non enregistrée :', error)
      return NextResponse.json({ success: false, message: 'Le service est momentanément indisponible. Réessaie dans un instant.' }, { status: 500 })
    }

    // redirectUrl absent = paiement manuel (Binance) : le client reçoit des instructions et la référence à indiquer.
    return NextResponse.json({ success: true, cartId: orderId, redirectUrl: created.redirectUrl ?? null, manual: created.manual ?? null })
  } catch (error) {
    if (error instanceof GatewayError) return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    console.error('Erreur checkout :', error)
    return NextResponse.json({ success: false, message: 'Le service est momentanément indisponible. Réessaie dans un instant.' }, { status: 500 })
  }
}
