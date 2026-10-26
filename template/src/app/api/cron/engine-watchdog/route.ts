import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { acquireCronLock, releaseCronLock } from '@/lib/cron-lock'
import { runWatchdogPass } from '@/lib/monitoring/provider-watchdog'

export const dynamic = 'force-dynamic'

// Sonde des moteurs (voir lib/monitoring/provider-watchdog.ts) : à appeler toutes les 1 à 2 minutes
// (Authorization: Bearer $CRON_SECRET). Ne fait rien tant que la sonde est coupée dans Administration › Moteurs IA
// (réglage par défaut) ou si ENGINE_WATCHDOG=off.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response('Unauthorized', { status: 401 })
  if (!(await acquireCronLock('engine-watchdog'))) return NextResponse.json({ success: true, skipped: 'already running' })
  try {
    return NextResponse.json({ success: true, ...(await runWatchdogPass()) })
  } catch (error) {
    console.error('engine-watchdog :', error)
    return NextResponse.json({ success: false }, { status: 500 })
  } finally {
    await releaseCronLock('engine-watchdog')
  }
}
