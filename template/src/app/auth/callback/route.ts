import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { publicOrigin } from '@/lib/site-url'
import { safeNext } from '@/lib/safe-next'

// Retour de Google (et des liens magiques) : échange le code contre une session, puis page demandée.
// L'adresse de destination vient de la configuration du site, jamais de l'en-tête Host.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  const origin = process.env.NODE_ENV === 'production' ? publicOrigin() : url.origin
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    console.error('Connexion Google : échange du code impossible :', error.message)
  }
  return NextResponse.redirect(`${origin}/login?erreur=connexion`)
}
