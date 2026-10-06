import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TWO_FACTOR_COOKIE } from '@/lib/auth/two-factor-gate'

// Logout: POST only (a link or an image must never log someone out).
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  response.cookies.delete(TWO_FACTOR_COOKIE) // la preuve de deuxième étape part avec la session
  return response
}
