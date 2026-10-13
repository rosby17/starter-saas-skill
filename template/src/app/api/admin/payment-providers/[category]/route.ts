import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/admin'
import { setActivePaymentProvider, setPaymentCategoryEnabled } from '@/lib/payments/settings'
import { isKnownCategory } from '@/lib/payments/providers'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: Promise<{ category: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error

  const { category } = await params
  if (!isKnownCategory(category)) return NextResponse.json({ success: false, message: 'Catégorie de paiement inconnue.' }, { status: 404 })

  try {
    const body = await request.json()
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    // { enabled: boolean } : proposer / retirer ce type de paiement ; { providerId } : changer de passerelle.
    const settings = typeof body?.enabled === 'boolean'
      ? await setPaymentCategoryEnabled(admin, category, body.enabled)
      : await setActivePaymentProvider(admin, category, String(body?.providerId || ''))
    return NextResponse.json({ success: true, settings: settings[category] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de mettre à jour ce moyen de paiement.'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
