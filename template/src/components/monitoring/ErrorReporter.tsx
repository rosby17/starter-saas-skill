'use client'

import { useEffect } from 'react'

// Envoie au journal (/admin/erreurs) les appels /api en échec et les erreurs JavaScript vus par le client.
// Aucun corps de requête n'est envoyé : seulement la route, le statut et le message renvoyé par l'API.
const REPORT = '/api/monitoring/errors'
const IGNORED = [REPORT, '/api/system-status'] // le sondage de la bannière ne regarde personne
const DEDUPE_MS = 30_000
const recent = new Map<string, number>()

const duplicate = (key: string) => {
  const last = recent.get(key)
  recent.set(key, Date.now())
  return last !== undefined && Date.now() - last < DEDUPE_MS
}

export function ErrorReporter() {
  useEffect(() => {
    const original = window.fetch.bind(window)
    const send = (report: Record<string, unknown>) =>
      original(REPORT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...report, page: window.location.pathname }), keepalive: true }).catch(() => {})

    window.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href)
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
      const tracked = url.origin === window.location.origin && url.pathname.startsWith('/api/') && !IGNORED.includes(url.pathname)
      try {
        const response = await original(input, init)
        if (tracked && response.status === 403 && !duplicate(`credits:${url.pathname}`)) {
          const data = await response.clone().json().catch(() => null)
          if (data?.error_code === 'insufficient_credits') window.dispatchEvent(new CustomEvent('insufficient-credits', { detail: typeof data.message === 'string' ? data.message : null }))
        }
        if (tracked && response.status >= 400 && !duplicate(`${method} ${url.pathname}:${response.status}`)) {
          const data = await response.clone().json().catch(() => null)
          const message = data?.message ?? data?.error
          void send({ kind: 'http', action: `${method} ${url.pathname}`, httpStatus: response.status, message: typeof message === 'string' ? message : undefined, errorCode: typeof data?.error_code === 'string' ? data.error_code : undefined })
        }
        return response
      } catch (error) {
        if (tracked && !(error instanceof DOMException && error.name === 'AbortError') && !duplicate(`${method} ${url.pathname}:network`)) {
          void send({ kind: 'network', action: `${method} ${url.pathname}`, message: error instanceof Error ? error.message : String(error) })
        }
        throw error
      }
    }
    let jsErrors = 0
    const onError = (event: ErrorEvent) => {
      if (!event.message || event.message === 'Script error.' || jsErrors >= 5 || duplicate(`js:${event.message}`)) return
      jsErrors += 1
      void send({ kind: 'js', action: 'Erreur JavaScript', message: event.message.slice(0, 2000), stack: event.error instanceof Error ? event.error.stack?.slice(0, 4000) : undefined })
    }
    window.addEventListener('error', onError)
    return () => {
      window.fetch = original
      window.removeEventListener('error', onError)
    }
  }, [])
  return null
}
