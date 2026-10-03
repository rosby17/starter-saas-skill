import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { acquireCronLock, releaseCronLock } from '@/lib/cron-lock'
import { serviceClient } from '@/lib/auth/service-client'

export const dynamic = 'force-dynamic'

// Taux de change en USD : à appeler chaque jour (Authorization: Bearer $CRON_SECRET).
// Le FCFA est arrimé à l'euro (1 EUR = 655,957 XOF/XAF), on le déduit donc du taux EUR.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response('Unauthorized', { status: 401 })
  if (!(await acquireCronLock('update-rates'))) return NextResponse.json({ success: true, skipped: 'already running' })
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    if (!res.ok) throw new Error(`Taux indisponibles : ${res.statusText}`)
    const data = await res.json()
    const eur = Number(data.rates?.EUR)
    if (!Number.isFinite(eur) || eur <= 0) throw new Error('Taux EUR introuvable dans la réponse.')

    const now = new Date().toISOString()
    // Plage de bon sens : un taux aberrant (erreur du fournisseur) ne doit pas fausser tous les prix.
    const fcfa = eur * 655.957
    const rows = [
      { currency_code: 'EUR', rate_to_usd: eur, updated_at: now },
      { currency_code: 'FCFA', rate_to_usd: fcfa, updated_at: now },
    ]
    if (eur < 0.3 || eur > 3 || fcfa < 200 || fcfa > 2000) throw new Error(`Taux hors plage (EUR ${eur}), non enregistrés.`)

    const { error } = await serviceClient().from('exchange_rates').upsert(rows, { onConflict: 'currency_code' })
    if (error) throw error
    return NextResponse.json({ success: true, eur, fcfa })
  } catch (error) {
    console.error('Cron update-rates :', error)
    return NextResponse.json({ success: false, error: 'Mise à jour des taux impossible.' }, { status: 500 })
  } finally {
    await releaseCronLock('update-rates')
  }
}
