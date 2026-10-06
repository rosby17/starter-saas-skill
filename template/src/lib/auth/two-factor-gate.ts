// VALIDATION EN DEUX ÉTAPES : « cette session a-t-elle passé la deuxième étape ? »
// Utilisable partout (middleware Edge, routes, pages) : Web Crypto uniquement, aucune requête en base.
//
// - Méthode « application » (TOTP de Supabase Auth) : la session passe au niveau aal2 après le code.
// - Méthode « e-mail » ou code de secours : un cookie signé, lié au compte ET à la session (session_id du jeton),
//   prouve la deuxième étape. Il ne sert à rien sur une autre session ni sur un autre compte.
// La méthode choisie est recopiée dans app_metadata.two_factor (lu dans l'utilisateur, sans requête).

import type { User } from '@supabase/supabase-js'

export const TWO_FACTOR_COOKIE = 'a2f'
export const TWO_FACTOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 jours ; inutile de toute façon une fois la session finie

export type TwoFactorMethod = 'email' | 'totp'

const encoder = new TextEncoder()

function base64url(bytes: ArrayBuffer): string {
  let text = ''
  for (const b of new Uint8Array(bytes)) text += String.fromCharCode(b)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Contenu du jeton d'accès (déjà vérifié par getUser) : session_id et niveau aal. */
export function tokenClaims(accessToken: string | undefined | null): { sessionId: string | null; aal: string | null } {
  try {
    const part = (accessToken || '').split('.')[1]
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return { sessionId: typeof json.session_id === 'string' ? json.session_id : null, aal: typeof json.aal === 'string' ? json.aal : null }
  } catch {
    return { sessionId: null, aal: null }
  }
}

function signingKey(): string {
  const key = process.env.TWO_FACTOR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('TWO_FACTOR_SECRET ou SUPABASE_SERVICE_ROLE_KEY manquant : impossible de signer la validation en deux étapes.')
  return key
}

async function sign(userId: string, sessionId: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(signingKey()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(`a2f:${userId}:${sessionId}`)))
}

/** Valeur du cookie qui prouve la deuxième étape pour CETTE session. */
export async function twoFactorCookieValue(userId: string, accessToken: string | undefined | null): Promise<string | null> {
  const { sessionId } = tokenClaims(accessToken)
  return sessionId ? sign(userId, sessionId) : null
}

async function cookieValid(value: string | undefined, userId: string, sessionId: string | null): Promise<boolean> {
  if (!value || !sessionId) return false
  const expected = await sign(userId, sessionId)
  if (expected.length !== value.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ value.charCodeAt(i)
  return diff === 0
}

export const hasVerifiedTotp = (user: User) => !!user.factors?.some((f) => f.factor_type === 'totp' && f.status === 'verified')

/** Méthode choisie par le compte (null = pas de validation en deux étapes). */
export function twoFactorMethod(user: User): TwoFactorMethod | null {
  if (hasVerifiedTotp(user)) return 'totp'
  return user.app_metadata?.two_factor === 'email' ? 'email' : null
}

/**
 * Deuxième étape encore à faire pour cette session ? Renvoie la méthode attendue, ou null si tout est en ordre.
 * `user` doit venir de getUser() (à jour), `accessToken` de la session courante, `cookie` du cookie TWO_FACTOR_COOKIE.
 */
export async function secondFactorPending(user: User, accessToken: string | undefined | null, cookie: string | undefined): Promise<TwoFactorMethod | null> {
  const method = twoFactorMethod(user)
  if (!method) return null
  const { sessionId, aal } = tokenClaims(accessToken)
  if (method === 'totp' && aal === 'aal2') return null
  if (await cookieValid(cookie, user.id, sessionId)) return null
  return method
}
