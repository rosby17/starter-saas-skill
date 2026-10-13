import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/auth/service-client'
import { getGateway } from '@/lib/payments/gateways'
import { PAYMENT_CATEGORIES, PAYMENT_PROVIDERS } from '@/lib/payments/providers'
import { getPaymentProviderSettings } from '@/lib/payments/settings'

export const dynamic = 'force-dynamic'

// Moyens de paiement proposés sur la page de paiement : seulement ceux dont une passerelle est configurée
// (clés posées dans /admin/keys) et que l'admin n'a pas coupés. Le checkout refait le même contrôle : c'est lui qui fait foi.
export async function GET() {
  const db = serviceClient()
  const methods: string[] = []
  const settings = await getPaymentProviderSettings(db).catch(() => null)
  for (const category of PAYMENT_CATEGORIES) {
    if (settings && !settings[category.id].enabled) continue
    const active = settings?.[category.id].active ?? null
    const ids = [active, ...PAYMENT_PROVIDERS[category.id].map((p) => p.id)].filter((x): x is string => !!x)
    if (ids.some((id) => getGateway(id)?.isConfigured())) methods.push(category.id)
  }
  return NextResponse.json({ success: true, methods }, { headers: { 'Cache-Control': 'no-store' } })
}
