import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { recordErrorLog } from '@/lib/monitoring/error-log'

// Reçoit les erreurs vues par un client (components/monitoring/ErrorReporter.tsx).
// L'identité vient de la session, jamais du corps de la requête.
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : null)

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  if (!checkRateLimit(`error-report:${user?.id || ip}`, 30, 5 * 60 * 1000).success) {
    return NextResponse.json({ success: false }, { status: 429 })
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const action = text(body?.action, 300)
  if (!action) return NextResponse.json({ success: false }, { status: 400 })
  const status = Number(body?.httpStatus)
  const errorCode = text(body?.errorCode, 60)
  const reference = await recordErrorLog({
    userId: user?.id,
    source: 'web',
    page: text(body?.page, 300),
    action,
    httpStatus: Number.isInteger(status) ? status : null,
    errorMessage: text(body?.message, 2000),
    details: { kind: text(body?.kind, 40), ...(errorCode ? { error_code: errorCode } : {}), ...(text(body?.stack, 4000) ? { stack: text(body?.stack, 4000) } : {}) },
    ip,
    userAgent: request.headers.get('user-agent'),
  })
  return NextResponse.json({ success: Boolean(reference), reference })
}
