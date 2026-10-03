import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { acquireCronLock, releaseCronLock } from '@/lib/cron-lock'
import { serviceClient } from '@/lib/auth/service-client'

export const dynamic = 'force-dynamic'

// Expire les lots de crédits échus (fonction SQL expire_credits, migration 0005) : à appeler chaque jour
// (Authorization: Bearer $CRON_SECRET). Seuls les plans qui définissent validityDays créent des crédits qui expirent.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response('Unauthorized', { status: 401 })
  if (!(await acquireCronLock('expire-credits'))) return NextResponse.json({ success: true, skipped: 'already running' })
  try {
    const { data, error } = await serviceClient().rpc('expire_credits')
    if (error) throw error
    return NextResponse.json({ success: true, processed: data })
  } catch (error) {
    console.error('Cron expire-credits :', error)
    return NextResponse.json({ success: false, error: "Expiration des crédits impossible." }, { status: 500 })
  } finally {
    await releaseCronLock('expire-credits')
  }
}
