import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { publicOrigin } from '@/lib/site-url'

/** Chemin interne sûr pour une redirection (jamais vers un autre site). */
export function safeNext(next: unknown, fallback = '/dashboard'): string {
  const value = typeof next === 'string' ? next : ''
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : fallback
}

/**
 * Lien de connexion directe (sans mot de passe) pour un compte EXISTANT.
 * Le jeton est créé par Supabase (usage unique, expire selon la configuration de l'auth : 1 h par défaut) ;
 * le lien pointe vers NOTRE site (/auth/confirm), qui le vérifie et ouvre la session.
 * L'e-mail est envoyé par nous (Brevo) : aucun réglage SMTP de Supabase n'est nécessaire.
 */
export async function createLoginLink(db: SupabaseClient, email: string, next = '/mes-achats'): Promise<string | null> {
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) {
    console.error('Lien de connexion impossible à créer :', error?.message)
    return null
  }
  const url = new URL('/auth/confirm', publicOrigin())
  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('type', 'magiclink')
  url.searchParams.set('next', safeNext(next))
  return url.toString()
}

/** Lien de secours quand le jeton n'a pas pu être créé : la page Connexion. */
export const loginPageUrl = (next = '/mes-achats') => `${publicOrigin()}/login?next=${encodeURIComponent(safeNext(next))}`
