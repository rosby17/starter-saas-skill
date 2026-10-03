import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getPlanById } from '@/lib/pricing'
import { getGateway } from '@/lib/payments/gateways'
import { getActivePaymentProvider } from '@/lib/payments/settings'
import { GatewayError } from '@/lib/payments/types'
import type { PaymentCategoryId } from '@/lib/payments/providers'

/**
 * Crée un lien de paiement et enregistre la commande « pending ».
 *
 * Même flux pour tous les SaaS :
 *  1. l'identité vient de la SESSION, jamais du corps de la requête ;
 *  2. le prix vient du catalogue serveur (pricing.ts), jamais du navigateur ;
 *  3. le client choisit un TYPE de paiement (paymentType) ; la passerelle est celle que
 *     l'administrateur a activée pour ce type (/admin/payment-providers).
 */
export async function POST(request: Request) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user || !user.email) {
      return NextResponse.json({ success: false, message: 'Connecte-toi pour payer.' }, { status: 401 })
    }

    const body = await request.json()
    const { firstName, lastName, phone, planId, currency } = body
    const paymentType: PaymentCategoryId = body.paymentType === 'card' ? 'card' : body.paymentType === 'paypal' ? 'paypal' : 'mobile_money'

    if (!firstName || !planId) {
      return NextResponse.json({ success: false, message: 'Le prénom et le forfait sont obligatoires.' }, { status: 400 })
    }
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

    let origin = (request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
    if (origin.includes('localhost')) origin = origin.replace('localhost', '127.0.0.1')
    const paymentCurrency = String(currency || plan.currency || 'XOF').toUpperCase()

    const created = await gateway.createCheckout({
      orderId: crypto.randomUUID(),
      plan,
      currency: paymentCurrency,
      customer: { email: user.email, firstName: String(firstName), lastName: String(lastName || ''), phone: phone ? String(phone).trim() : undefined },
      origin,
    })
    const orderId = created.orderId || created.providerRef

    const { error } = await db.from('orders').insert({
      id: orderId,
      user_id: user.id,
      plan_name: plan.name,
      credits: plan.credits,
      amount_local: plan.amountLocal,
      currency: paymentCurrency,
      payment_method: gateway.paymentMethod,
      payment_ref: created.providerRef,
      status: 'pending',
    })
    if (error) console.error('Commande « pending » non enregistrée :', error)

    return NextResponse.json({ success: true, cartId: orderId, redirectUrl: created.redirectUrl })
  } catch (error) {
    if (error instanceof GatewayError) return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    console.error('Erreur checkout :', error)
    return NextResponse.json({ success: false, message: 'Le service est momentanément indisponible. Réessaie dans un instant.' }, { status: 500 })
  }
}
