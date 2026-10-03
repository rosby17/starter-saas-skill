import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/admin'
import { getPaymentProviderSettings } from '@/lib/payments/settings'
import { PAYMENT_CATEGORIES, PAYMENT_PROVIDERS } from '@/lib/payments/providers'
import { getGateway } from '@/lib/payments/gateways'

export const dynamic = 'force-dynamic'

const adminDatabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  try {
    const settings = await getPaymentProviderSettings(adminDatabase())
    const categories = PAYMENT_CATEGORIES.map((category) => ({
      ...category,
      providers: PAYMENT_PROVIDERS[category.id].map((provider) => ({
        ...provider,
        active: settings[category.id].active === provider.id,
        configured: getGateway(provider.id)?.isConfigured() ?? false,
      })),
    }))
    return NextResponse.json({ success: true, categories })
  } catch (error) {
    console.error('Lecture des moyens de paiement impossible :', error)
    return NextResponse.json({ success: false, message: 'Impossible de lire les moyens de paiement.' }, { status: 500 })
  }
}
