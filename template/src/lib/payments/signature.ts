import { createHmac, timingSafeEqual } from 'crypto'

// Comparaison en temps constant : empêche de deviner un secret caractère par caractère via les temps de réponse.
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

export const hmacHex = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex')
