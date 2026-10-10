import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

// Cookie HttpOnly signé posé au moment du checkout : il prouve que CE navigateur a lancé CETTE commande.
// Il permet au client sans session (achat sans compte) de suivre son paiement sur /paiement/succes,
// et, si son compte vient d'être créé par cet achat, d'y entrer directement une fois le paiement confirmé.
export const ORDER_COOKIE = 'rm_order'
const MAX_AGE = 60 * 60 * 24 * 2 // 2 jours

function key(): string {
  const base = process.env.APP_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('Clé de signature absente (SUPABASE_SERVICE_ROLE_KEY).')
  return `order-cookie:v1:${base}`
}

const sign = (payload: string) => createHmac('sha256', key()).update(payload).digest('base64url')

export async function setOrderCookie(orderId: string): Promise<void> {
  const expires = Date.now() + MAX_AGE * 1000
  const payload = `${orderId}.${expires}`
  ;(await cookies()).set(ORDER_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })
}

/** Identifiant de commande prouvé par le cookie de ce navigateur, ou null. */
export async function readOrderCookie(): Promise<string | null> {
  const raw = (await cookies()).get(ORDER_COOKIE)?.value
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 3) return null
  const [orderId, expires, signature] = parts
  const expected = Buffer.from(sign(`${orderId}.${expires}`))
  const provided = Buffer.from(signature)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null
  if (Number(expires) < Date.now()) return null
  return /^[0-9a-f-]{36}$/i.test(orderId) ? orderId : null
}

export async function clearOrderCookie(): Promise<void> {
  ;(await cookies()).delete(ORDER_COOKIE)
}
