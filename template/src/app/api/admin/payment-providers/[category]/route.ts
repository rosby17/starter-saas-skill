import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/admin'
import { setActivePaymentProvider } from '@/lib/payments/settings'
import { isKnownCategory } from '@/lib/payments/providers'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: Promise<{ category: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error

  const { category } = await params
  if (!isKnownCategory(category)) return NextResponse.json({ success: false, message: 'Catégorie de paiement inconnue.' }, { status: 404 })

  try {
    const body = z.object({ providerId: z.string().min(1).max(40) }).safeParse(await request.json().catch(() => null))
    if (!body.success) return NextResponse.json({ success: false, message: 'Moyen de paiement manquant.' }, { status: 400 })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    const settings = await setActivePaymentProvider(admin, category, body.data.providerId)
    return NextResponse.json({ success: true, settings: settings[category] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de mettre à jour ce moyen de paiement.'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
