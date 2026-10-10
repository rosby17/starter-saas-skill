import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { publicOrigin } from '@/lib/site-url'

// Logout: POST only (a link or an image must never log someone out).
// Redirection vers l'adresse PUBLIQUE du site : derrière le proxy, request.url vaut l'adresse interne (https://[::]:3000).
export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', publicOrigin()), { status: 303 })
}
