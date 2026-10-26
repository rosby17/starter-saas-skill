import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/auth/service-client'
import { getGateway } from '@/lib/payments/gateways'
import { isGatewayKeyRefused } from '@/lib/payments/gateway-alert'
import { PAYMENT_CATEGORIES, PAYMENT_PROVIDERS, type PaymentCategoryId } from '@/lib/payments/providers'
import { getPaymentProviderSettings } from '@/lib/payments/settings'
import { visitorCountry } from '@/lib/pricing/server'

export const dynamic = 'force-dynamic'

// Moyens de paiement proposés sur la page de paiement, DANS L'ORDRE d'affichage : seulement ceux dont une passerelle
// est configurée (clés posées dans /admin/keys), dont la clé n'est pas refusée en ce moment, et que l'admin n'a pas
// coupés. Mobile Money direct : en premier dans le pays de ses numéros (MOMO_DIRECT_COUNTRY), en dernier ailleurs.
// Aucun nom de passerelle n'est renvoyé. Le checkout refait le même contrôle : c'est lui qui fait foi.
export async function GET(request: Request) {
  const db = serviceClient()
  const methods: PaymentCategoryId[] = []
  const settings = await getPaymentProviderSettings(db).catch(() => null)
  for (const category of PAYMENT_CATEGORIES) {
    if (settings && !settings[category.id].enabled) continue
    const active = settings?.[category.id].active ?? null
    const ids = [active, ...PAYMENT_PROVIDERS[category.id].map((p) => p.id)].filter((x): x is string => !!x)
    if (ids.some((id) => getGateway(id)?.isConfigured() && !isGatewayKeyRefused(id))) methods.push(category.id)
  }
  if (methods.includes('momo_direct')) {
    const home = (process.env.MOMO_DIRECT_COUNTRY || '').trim().toUpperCase()
    const local = home && (await visitorCountry(request)) === home
    const others = methods.filter((m) => m !== 'momo_direct')
    methods.splice(0, methods.length, ...(local ? ['momo_direct' as const, ...others] : [...others, 'momo_direct' as const]))
  }
  return NextResponse.json({ success: true, methods }, { headers: { 'Cache-Control': 'no-store' } })
}
