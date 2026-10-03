import { NextResponse } from 'next/server'

// Pour Docker / Coolify / un moniteur : 200 tant que l'application répond.
export const dynamic = 'force-dynamic'
export function GET() {
  return NextResponse.json({ ok: true, time: new Date().toISOString() })
}
