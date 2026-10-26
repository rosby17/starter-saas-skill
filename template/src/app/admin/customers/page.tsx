'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { flagOf } from '@/lib/countries'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/choice'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/dialog'
import { ProBadge } from '@/components/ProBadge'
import { Notice, api, inputClass } from '@/components/admin/kit'
import { SuspendReasonMenu } from '@/components/admin/SuspendReasonMenu'
import { ACTIVITY_LABEL, DEFAULT_ACCOUNT_FILTER, FILTER_LABELS, type AccountFilter } from '@/lib/admin/account-filters'
import { findSuspensionReason, type SuspensionReasonCode } from '@/lib/admin/suspension-reasons'
import { siWhatsapp } from 'simple-icons'

type Customer = {
  id: string; email: string | null; full_name: string | null; phone: string | null; country: string | null; is_admin: boolean; created_at: string
  purchases: number; pro: boolean; status: 'pro' | 'eleve' | 'inscrit'; pending: boolean; payment_method: string | null
  is_internal: boolean; activity: 'active' | 'inactive' | 'dormant'; spent: boolean; suspended: boolean; suspension_reason: string | null; suspect: boolean; domain: string
}
type Counts = { total: number; users: number; suspended: number; internal: number; suspect_live: number }
type Data = { customers: Customer[]; total: number; pageSize: number; counts: Counts | null }

const waLink = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, '')}`
const options = <K extends keyof typeof FILTER_LABELS>(k: K) =>
  Object.entries(FILTER_LABELS[k]).map(([value, label]) => ({ value, label: label as string }))
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

export default function AdminCustomersPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const [filter, setFilter] = useState<AccountFilter>(DEFAULT_ACCOUNT_FILTER)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [domain, setDomain] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)

  const load = useCallback(async () => {
    const d = await api<Data>(`/api/admin/customers?${new URLSearchParams({ ...filter, page: String(page) })}`)
    if (d.success) { setData(d); setError('') } else setError(d.message || 'Lecture des clients impossible.')
  }, [filter, page])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  const change = (patch: Partial<AccountFilter>) => { setPage(1); setPicked([]); setFilter((f) => ({ ...f, ...patch })) }
  const rows = data?.customers ?? []
  const allPicked = rows.length > 0 && rows.every((c) => picked.includes(c.id))
  // Cible des actions en lot : les comptes cochés, sinon TOUT ce qui correspond au filtre (toutes les pages).
  const target = picked.length ? { ids: picked } : { filter }
  const targetLabel = picked.length ? `${picked.length} compte(s) coché(s)` : `les ${fmt(data?.total ?? 0)} compte(s) du filtre`

  const run = async (body: Record<string, unknown>, question: { title: string; message: string; confirmLabel: string; danger?: boolean }) => {
    if (!(await confirm(question))) return
    setBusy(true)
    const d = await api('/api/admin/customers/bulk', 'POST', body)
    setBusy(false)
    setMessage({ tone: d.success ? 'green' : 'red', text: d.message || (d.success ? 'Fait.' : 'Action impossible.') })
    setPicked([])
    load()
  }
  const suspend = (code: SuspensionReasonCode) => run({ action: 'suspend', reason_code: code, ...target }, {
    title: `Suspendre ${targetLabel} ?`, danger: true, confirmLabel: 'Suspendre',
    message: `Motif : « ${findSuspensionReason(code)?.label} ». Chaque compte reçoit l’e-mail de ce motif et ne peut plus se connecter. Toi, les administrateurs et les comptes internes ne sont jamais suspendus en lot.`,
  })
  const blockDomain = (code: SuspensionReasonCode) => run({ action: 'block_domain', domain, reason_code: code }, {
    title: `Bloquer ${domain} ?`, danger: true, confirmLabel: 'Bloquer et suspendre',
    message: `Plus aucune inscription avec une adresse @${domain}, et ses comptes ouverts sont suspendus (motif « ${findSuspensionReason(code)?.label} », e-mail envoyé).`,
  })

  const btn = 'inline-flex items-center gap-2 rounded-full border border-gray-300 px-3.5 py-1.5 text-sm hover:border-gray-400 disabled:opacity-50'
  const counts = data?.counts

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl">Clients</h1>
          <p className="text-sm text-gray-500">
            {counts ? `${fmt(counts.users)} compte(s) ouvert(s)` : 'Chaque acheteur et chaque demande crée une fiche : nom, e-mail, WhatsApp, pays.'}
            {counts && counts.suspended > 0 && ` · ${fmt(counts.suspended)} suspendu(s)`}
            {counts && counts.internal > 0 && ` · ${fmt(counts.internal)} interne(s)`}
          </p>
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

      {counts && counts.suspect_live > 0 && filter.risk !== 'suspect' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <span>{fmt(counts.suspect_live)} compte(s) ouvert(s) avec une adresse suspecte (domaine jetable ou bloqué).</span>
          <button type="button" onClick={() => change({ risk: 'suspect', account: 'live' })} className="ml-auto rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white">Les afficher</button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input className={inputClass} placeholder="Nom, e-mail, numéro…" aria-label="Rechercher un client" value={filter.q} onChange={(e) => change({ q: e.target.value })} />
        <Select value={filter.account} onChange={(v) => change({ account: v as AccountFilter['account'] })} options={options('account')} />
        <Select value={filter.activity} onChange={(v) => change({ activity: v as AccountFilter['activity'] })} options={options('activity')} />
        <Select value={filter.spent} onChange={(v) => change({ spent: v as AccountFilter['spent'] })} options={options('spent')} />
        <Select value={filter.risk} onChange={(v) => change({ risk: v as AccountFilter['risk'] })} options={options('risk')} />
      </div>
      <p className="text-xs text-gray-500">Actif = a consommé des crédits, payé une commande ou suivi une leçon dans les 30 derniers jours (une simple connexion ne compte pas). Le numéro se cherche par ses chiffres, avec ou sans indicatif.</p>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {error && <Notice tone="red">{error}</Notice>}

      {/* Actions en lot : sur la sélection, ou sur tout le filtre si rien n'est coché. */}
      <section className="space-y-3 rounded-2xl border border-gray-200 bg-surface p-4">
        <p className="text-sm"><span className="font-medium">Actions en lot</span> <span className="text-gray-500">sur {targetLabel}</span></p>
        <div className="flex flex-wrap gap-2">
          <SuspendReasonMenu disabled={busy || !data?.total} onPick={suspend} className={`${btn} text-red-700`}>Suspendre…</SuspendReasonMenu>
          <button type="button" disabled={busy || !data?.total} className={btn}
            onClick={() => run({ action: 'unsuspend', ...target }, { title: `Réactiver ${targetLabel} ?`, message: 'Les comptes suspendus peuvent de nouveau se connecter.', confirmLabel: 'Réactiver' })}>Réactiver</button>
          <button type="button" disabled={busy || !data?.total} className={btn}
            onClick={() => run({ action: 'mark_internal', ...target }, { title: `Marquer ${targetLabel} comme internes ?`, message: 'Équipe, testeurs, comptes de démonstration : jamais suspendus en lot, faciles à exclure des chiffres.', confirmLabel: 'Marquer internes' })}>Marquer internes</button>
          <button type="button" disabled={busy || !data?.total} className={btn}
            onClick={() => run({ action: 'unmark_internal', ...target }, { title: `Retirer la marque « interne » de ${targetLabel} ?`, message: 'Ces comptes redeviennent des clients comme les autres.', confirmLabel: 'Retirer' })}>Retirer « interne »</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
          <input className={`${inputClass} sm:max-w-xs`} placeholder="domaine.com" aria-label="Domaine d’e-mail" value={domain} onChange={(e) => setDomain(e.target.value.trim().toLowerCase().replace(/^@/, ''))} />
          <SuspendReasonMenu disabled={busy || !domain} onPick={blockDomain} className={`${btn} text-red-700`}>Bloquer le domaine…</SuspendReasonMenu>
          <button type="button" disabled={busy || !domain} className={btn}
            onClick={() => run({ action: 'allow_domain', domain }, { title: `${domain} : site sérieux ?`, message: `Les adresses @${domain} ne seront plus jamais classées suspectes, même si le domaine figure dans la liste des adresses jetables.`, confirmLabel: 'Ne pas bannir' })}>Site sérieux : ne pas bannir</button>
        </div>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="w-10 py-3 pl-4">
              <Checkbox checked={allPicked} onChange={(v) => setPicked(v ? rows.map((c) => c.id) : [])} label={<span className="sr-only">Tout cocher sur cette page</span>} />
            </th>
            <th className="px-3 py-3 font-medium">Client</th><th className="px-3 py-3 font-medium">Statut</th><th className="px-3 py-3 font-medium">Activité</th><th className="px-3 py-3 font-medium">Achats</th>
            <th className="px-3 py-3 font-medium">A payé par</th><th className="px-3 py-3 font-medium">Pays</th><th className="px-3 py-3 font-medium">Depuis</th><th className="px-5 py-3" />
          </tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} onClick={() => router.push(`/admin/customers/${c.id}`)} className="cursor-pointer border-b border-gray-200 last:border-0 hover:bg-gray-100">
                <td className="py-3.5 pl-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={picked.includes(c.id)} onChange={(v) => setPicked((x) => (v ? [...x, c.id] : x.filter((y) => y !== c.id)))} label={<span className="sr-only">Cocher {c.full_name || c.email}</span>} />
                </td>
                <td className="px-3 py-3.5">
                  {/* Nom ET e-mail mènent à la fiche (vrais liens : ouverture dans un nouvel onglet possible). */}
                  <Link href={`/admin/customers/${c.id}`} onClick={(e) => e.stopPropagation()} className="flex flex-wrap items-center gap-2 font-medium hover:text-brand">
                    {c.full_name || '—'}{c.is_admin && <Badge tone="amber">Admin</Badge>}{c.is_internal && <Badge>Interne</Badge>}
                  </Link>
                  <Link href={`/admin/customers/${c.id}`} onClick={(e) => e.stopPropagation()} className="text-xs text-gray-500 hover:text-brand">{c.email}</Link>
                </td>
                <td className="px-3">
                  {c.suspended ? <Badge tone="red">Suspendu</Badge>
                    : c.status === 'pro' ? <span className="inline-flex items-center gap-2"><ProBadge size="sm" /><span className="text-xs text-gray-600">Membre Pro</span></span>
                    : c.status === 'eleve' ? <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">Élève</span>
                    : <span className="text-xs text-gray-500">Inscrit</span>}
                  {c.suspect && !c.suspended && <span className="ml-2"><Badge tone="amber">Adresse suspecte</Badge></span>}
                  {c.pending && <span className="ml-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">commande en attente</span>}
                </td>
                <td className="px-3 text-xs text-gray-600">{ACTIVITY_LABEL[c.activity]}</td>
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
            {data && !rows.length && <tr><td colSpan={9} className="p-6 text-center text-sm text-gray-500">Aucun compte ne correspond.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => { setPicked([]); setPage(page - 1) }} className="rounded-lg border border-gray-300 px-3 py-1 disabled:opacity-40">Précédent</button>
          <span>Page {page} · {fmt(data.total)} client(s)</span>
          <button disabled={page * data.pageSize >= data.total} onClick={() => { setPicked([]); setPage(page + 1) }} className="rounded-lg border border-gray-300 px-3 py-1 disabled:opacity-40">Suivant</button>
        </div>
      )}
    </main>
  )
}
