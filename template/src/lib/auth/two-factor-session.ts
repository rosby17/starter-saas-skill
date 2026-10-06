import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TWO_FACTOR_COOKIE, TWO_FACTOR_COOKIE_MAX_AGE, secondFactorPending, twoFactorCookieValue } from '@/lib/auth/two-factor-gate'

// Contexte d'une route ou d'une page serveur : utilisateur à jour, jeton de la session, deuxième étape en attente.
export async function twoFactorContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token ?? null
  const cookie = (await cookies()).get(TWO_FACTOR_COOKIE)?.value
  const pending = await secondFactorPending(user, accessToken, cookie)
  return { supabase, user, accessToken, pending }
}

/** Pose le cookie « deuxième étape faite » pour la session courante. */
export async function markSecondFactorDone(response: NextResponse, userId: string, accessToken: string | null): Promise<NextResponse> {
  const value = await twoFactorCookieValue(userId, accessToken)
  if (value) {
    response.cookies.set(TWO_FACTOR_COOKIE, value, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TWO_FACTOR_COOKIE_MAX_AGE,
    })
  }
  return response
}
