import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth/access-link'
import { publicOrigin } from '@/lib/site-url'

// Ouverture de session depuis un lien reçu par e-mail (lien magique, accès livré) : vérifie le jeton à usage unique,
// pose les cookies de session, puis redirige vers une page INTERNE du site.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = (searchParams.get('type') || 'magiclink') as EmailOtpType
  const next = safeNext(searchParams.get('next'))

  if (tokenHash && ['magiclink', 'email', 'recovery', 'invite', 'signup'].includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(type === 'recovery' ? '/settings' : next, publicOrigin()))
  }
  // Adresse publique fixée côté serveur : derrière le proxy de Coolify, request.url peut être l'adresse interne.
  const url = new URL('/login', publicOrigin())
  url.searchParams.set('lien', 'expire')
  url.searchParams.set('next', next)
  return NextResponse.redirect(url)
}
