import { NextResponse } from 'next/server'
import { twoFactorContext } from '@/lib/auth/two-factor-session'
import { backupCodesLeft } from '@/lib/auth/two-factor'
import { twoFactorMethod } from '@/lib/auth/two-factor-gate'

export const dynamic = 'force-dynamic'

// État de la validation en deux étapes du compte connecté (page Mon compte).
export async function GET() {
  const ctx = await twoFactorContext()
  if (!ctx) return NextResponse.json({ success: false, message: 'Non connecté.' }, { status: 401 })
  const method = twoFactorMethod(ctx.user)
  return NextResponse.json({
    success: true,
    method,
    pending: ctx.pending,
    backupCodesLeft: method ? await backupCodesLeft(ctx.user.id) : 0,
  })
}
