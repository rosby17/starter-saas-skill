import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { serviceClient } from '@/lib/auth/service-client'
import { buildRevenueReport } from '@/lib/finance/revenue'

export const dynamic = 'force-dynamic'

// Revenus de la période, charges et marge réelle : GET /api/admin/finance/revenue?from=AAAA-MM-JJ&to=AAAA-MM-JJ&group=day
// Montants en FCFA ; la page les convertit dans la devise de l'administration (renvoyée avec les taux).
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.error
  try {
    const report = await buildRevenueReport(serviceClient(), new URL(request.url).searchParams)
    return NextResponse.json({ success: true, report }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Revenus :', error)
    return NextResponse.json({ success: false, message: 'Calcul des revenus impossible.' }, { status: 500 })
  }
}
