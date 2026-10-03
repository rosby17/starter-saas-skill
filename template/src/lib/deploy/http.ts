// Appels JSON aux API de mise en ligne (Supabase, Coolify, GitHub, Hostinger, Cloudflare).
// Les jetons ne sont jamais renvoyés au navigateur ni écrits dans les journaux.

export class DeployError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export async function callJson<T = unknown>(
  service: string,
  url: string,
  token: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string>; okStatuses?: number[] } = {}
): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: init.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    })
  } catch (error) {
    throw new DeployError(`${service} injoignable (${(error as Error).message}).`, 502)
  }
  const text = await res.text()
  let data: unknown = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok && !(init.okStatuses || []).includes(res.status)) {
    const detail = typeof data === 'object' && data ? JSON.stringify(data).slice(0, 300) : String(text).slice(0, 300)
    if (res.status === 401 || res.status === 403) throw new DeployError(`${service} refuse la clé (${res.status}) : vérifie-la ou ses droits. ${detail}`, 400)
    throw new DeployError(`${service} a répondu ${res.status} : ${detail}`, 502)
  }
  return data as T
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Nom de domaine propre : « https://www.Mon-Site.com/ » → « mon-site.com ». */
export function normalizeDomain(input: string): string {
  const d = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) throw new DeployError('Nom de domaine invalide (exemple : monsaas.com).')
  return d
}
