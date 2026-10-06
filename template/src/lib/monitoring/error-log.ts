import { randomInt } from 'crypto'
import { serviceClient } from '@/lib/auth/service-client'

// Référence courte, lisible au téléphone (sans 0/O ni 1/I), que le client transmet au support.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const createErrorReference = () =>
  'ERR-' + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

export type ErrorLogInput = {
  userId?: string | null
  source: 'web' | 'server' | 'api'
  page?: string | null
  action: string
  httpStatus?: number | null
  errorMessage?: string | null
  details?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
}

const cut = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null)

// Ne lève jamais : journaliser une erreur ne doit pas en provoquer une autre.
export async function recordErrorLog(input: ErrorLogInput): Promise<string | null> {
  const reference = createErrorReference()
  try {
    const { error } = await serviceClient().from('error_logs').insert({
      reference,
      user_id: input.userId ?? null,
      source: input.source,
      page: cut(input.page, 300),
      action: cut(input.action, 300),
      http_status: input.httpStatus ?? null,
      error_message: cut(input.errorMessage, 2000),
      details: input.details ?? {},
      ip: cut(input.ip, 100),
      user_agent: cut(input.userAgent, 300),
    })
    if (error) throw error
    return reference
  } catch (error) {
    console.error('[error-log] enregistrement impossible', error)
    return null
  }
}
