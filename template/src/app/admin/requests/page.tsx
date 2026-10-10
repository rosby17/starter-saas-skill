'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { api } from '@/components/admin/kit'
import { REQUEST_KINDS, type RequestKind } from '@/lib/catalog/types'
import { REQUEST_STATUS } from '@/lib/requests'

type Row = { id: string; kind: string; status: string; created_at: string; admin_reply: string | null; profile: { full_name: string | null; email: string | null; phone: string | null } | null }

function RequestsList() {
  const params = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || '')
  const [kind, setKind] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  useEffect(() => {
    api<{ requests: Row[] }>(`/api/admin/requests?${new URLSearchParams({ status, kind })}`).then((d) => setRows(d.success ? d.requests : []))
  }, [status, kind])

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-3xl md:text-4xl">Devis et coaching</h1>
        <p className="mt-1 text-sm text-gray-500">Ce que les clients te demandent en dehors des formations : formulaire de départ d’un coaching ou d’un accompagnement, demande de devis (site, SaaS, design).</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Select className="w-56" value={status} onChange={setStatus} options={[{ value: '', label: 'Tous les statuts' }, ...Object.entries(REQUEST_STATUS).map(([value, s]) => ({ value, label: s.label }))]} />
        <Select className="w-72" value={kind} onChange={setKind} options={[{ value: '', label: 'Tous les types' }, ...Object.entries(REQUEST_KINDS).map(([value, label]) => ({ value, label }))]} />
      </div>
      {!rows ? <p className="text-sm text-gray-500">Chargement…</p> : !rows.length ? <p className="text-sm text-gray-500">Aucune demande.</p> : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-surface">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/requests/${r.id}`} className="flex flex-wrap items-center gap-3 p-4 text-sm hover:bg-gray-100">
                <span className="font-medium">{REQUEST_KINDS[r.kind as RequestKind] ?? r.kind}</span>
                <Badge tone={REQUEST_STATUS[r.status]?.tone ?? 'gray'}>{REQUEST_STATUS[r.status]?.label ?? r.status}</Badge>
                <span className="text-gray-600">{r.profile?.full_name ?? r.profile?.email ?? '—'}</span>
                <span className="text-gray-500">{r.profile?.phone}</span>
                <span className="ml-auto text-xs text-gray-500">{new Date(r.created_at).toLocaleString('fr-FR')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default function AdminRequestsPage() {
  return <Suspense fallback={null}><RequestsList /></Suspense>
}
