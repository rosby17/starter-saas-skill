'use client'

import { useRouter } from 'next/navigation'
import { flagOf } from '@/lib/countries'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/card'
import { ProBadge } from '@/components/ProBadge'
import { api, inputClass } from '@/components/admin/kit'
import { siWhatsapp } from 'simple-icons'

type Customer = { id: string; email: string | null; full_name: string | null; phone: string | null; country: string | null; is_admin: boolean; created_at: string; purchases: number; pro: boolean; status: 'pro' | 'eleve' | 'inscrit'; pending: boolean; payment_method: string | null }

const waLink = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, '')}`

export default function AdminCustomersPage() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ customers: Customer[]; total: number; pageSize: number } | null>(null)

  const load = useCallback(async () => {
    const d = await api<{ customers: Customer[]; total: number; pageSize: number }>(`/api/admin/customers?${new URLSearchParams({ q, page: String(page) })}`)
    if (d.success) setData(d)
  }, [q, page])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl">Clients</h1>
          <p className="text-sm text-gray-500">Chaque acheteur et chaque demande crée une fiche : nom, e-mail, WhatsApp, pays.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {/* Téléchargements de fichiers (route API), pas des pages : un lien <a> classique est voulu. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/admin/customers/export?format=csv" className="rounded-full border border-gray-300 px-4 py-2 text-sm hover:border-brand">Exporter (Excel / CSV)</a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/admin/customers/export?format=vcf" className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">Contacts pour WhatsApp (.vcf)</a>
        </div>
      </div>
      <p className="text-xs text-gray-500">Le fichier .vcf s’ouvre sur ton téléphone : « Importer » ajoute tous les clients à tes contacts (nom suivi de « (RM) »), et ils apparaissent dans WhatsApp.</p>
      <p className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5"><ProBadge size="sm" /> Membre Pro : abonnement « Rester à jour » en cours</span>
        <span className="inline-flex items-center gap-1.5"><span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 font-medium text-green-800">Élève</span> a payé au moins une formation</span>
        <span>Inscrit : compte créé, rien payé</span>
      </p>
      <input className={`${inputClass} max-w-md`} placeholder="Rechercher un nom, un e-mail, un numéro…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} />
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-surface">
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-5 py-3 font-medium">Client</th><th className="px-3 py-3 font-medium">Statut</th><th className="px-3 py-3 font-medium">Achats</th>
            <th className="px-3 py-3 font-medium">A payé par</th><th className="px-3 py-3 font-medium">Pays</th><th className="px-3 py-3 font-medium">Depuis</th><th className="px-5 py-3" />
          </tr></thead>
          <tbody>
            {(data?.customers ?? []).map((c) => (
              <tr key={c.id} onClick={() => router.push(`/admin/customers/${c.id}`)} className="cursor-pointer border-b border-gray-200 last:border-0 hover:bg-gray-100">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2 font-medium">{c.full_name || '—'}{c.is_admin && <Badge tone="amber">Admin</Badge>}</div>
                  <div className="text-xs text-gray-500">{c.email}</div>
                </td>
                <td className="px-3">
                  {c.status === 'pro' ? <span className="inline-flex items-center gap-2"><ProBadge size="sm" /><span className="text-xs text-gray-600">Membre Pro</span></span>
                    : c.status === 'eleve' ? <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">Élève</span>
                    : <span className="text-xs text-gray-500">Inscrit</span>}
                  {c.pending && <span className="ml-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">commande en attente</span>}
                </td>
                <td className="px-3">{c.purchases}</td>
                <td className="px-3 text-gray-600">{c.payment_method || '—'}</td>
                <td className="px-3 text-gray-600">{c.country ? <span className="inline-flex items-center gap-1.5"><span className="text-lg leading-none">{flagOf(c.country)}</span>{c.country}</span> : '—'}</td>
                <td className="px-3 text-gray-600">{new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                <td className="px-5 text-right">
                  {c.phone && (
                    <a href={waLink(c.phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      aria-label={`WhatsApp de ${c.full_name || 'ce client'}`} className="inline-grid h-9 w-9 place-items-center rounded-full bg-[#25D366] text-white hover:opacity-90"><svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden><path d={siWhatsapp.path} /></svg></a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && (
        <div className="flex items-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-gray-300 px-3 py-1 disabled:opacity-40">Précédent</button>
          <span>Page {page} · {data.total} client(s)</span>
          <button disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)} className="rounded-lg border border-gray-300 px-3 py-1 disabled:opacity-40">Suivant</button>
        </div>
      )}
    </main>
  )
}
