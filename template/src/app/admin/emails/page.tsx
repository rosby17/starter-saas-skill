'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge, Card } from '@/components/ui/card'

type LogRow = {
  id: string
  created_at: string
  to_email: string
  subject: string
  template: string | null
  status: 'sent' | 'failed' | 'skipped'
  provider_status: number | null
  provider_response: string | null
  is_example: boolean
}
type ExampleResult = { id: string; label: string; ok: boolean; message: string }

const STATUS: Record<LogRow['status'], { label: string; tone: 'green' | 'red' | 'gray' }> = {
  sent: { label: 'Envoyé', tone: 'green' },
  failed: { label: 'Échec', tone: 'red' },
  skipped: { label: 'Sauté', tone: 'gray' },
}

// Administration › E-mails : un exemple de chaque modèle envoyé à l'admin, et le journal des derniers envois
// avec la réponse du fournisseur en cas d'échec.
export default function AdminEmailsPage() {
  const [rows, setRows] = useState<LogRow[] | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<{ to: string; list: ExampleResult[] } | null>(null)

  const load = useCallback(async (p: number) => {
    try {
      const res = await fetch(`/api/admin/emails?page=${p}`)
      const data = await res.json()
      if (!data.success) return setError(data.message)
      setRows(data.emails)
      setHasMore(data.hasMore)
      setPage(p)
    } catch {
      setError('Journal illisible : vérifie ta connexion.')
    }
  }, [])
  useEffect(() => { load(0) }, [load])

  const sendExamples = async () => {
    setSending(true)
    setError(null)
    setResults(null)
    try {
      const res = await fetch('/api/admin/emails/examples', { method: 'POST' })
      const data = await res.json()
      if (!data.success) setError(data.message)
      else setResults({ to: data.to, list: data.results })
      load(0)
    } catch {
      setError('Envoi impossible : vérifie ta connexion.')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="max-w-5xl space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-bold">E-mails</h1>
        <p className="text-sm text-gray-500">Vérifie l’allure de chaque e-mail et ce qui est vraiment parti.</p>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">Exemples</h2>
        <p className="mb-4 text-sm text-gray-500">Chaque modèle d’e-mail du site, avec des données fictives et un sujet commençant par « [Exemple] », envoyé uniquement à ton adresse.</p>
        <Button type="button" onClick={sendExamples} disabled={sending}>{sending ? 'Envoi en cours…' : 'M’envoyer un exemple de chaque e-mail'}</Button>
        {results && (
          <div className="mt-4">
            <p className="mb-2 text-sm">Envoyés à <b>{results.to}</b> : {results.list.filter((r) => r.ok).length} sur {results.list.length}.</p>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {results.list.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <Badge tone={r.ok ? 'green' : 'red'}>{r.ok ? 'Envoyé' : 'Échec'}</Badge>
                  <span className="font-medium">{r.label}</span>
                  {!r.ok && <span className="w-full text-red-700">{r.message}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-semibold">Derniers e-mails</h2>
          <Button type="button" variant="ghost" className="ml-auto" onClick={() => load(page)}>Rafraîchir</Button>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white">
          {!rows && !error && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
          {rows && !rows.length && <p className="p-6 text-center text-sm text-gray-500">Aucun e-mail envoyé pour l’instant.</p>}
          <ul className="divide-y divide-gray-100">
            {rows?.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.subject}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {r.to_email} · {new Date(r.created_at).toLocaleString('fr-FR')}{r.template ? ` · ${r.template}` : ''}{r.is_example ? ' · exemple' : ''}
                  </span>
                </span>
                {r.status === 'failed' && (
                  <span className="w-full rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                    Réponse du fournisseur{r.provider_status ? ` (${r.provider_status})` : ''} : <span className="break-words font-mono">{r.provider_response || 'aucune réponse'}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        {(page > 0 || hasMore) && (
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="secondary" disabled={page === 0} onClick={() => load(page - 1)}>← Plus récents</Button>
            <Button type="button" variant="secondary" disabled={!hasMore} onClick={() => load(page + 1)}>Plus anciens →</Button>
          </div>
        )}
      </section>
    </main>
  )
}
