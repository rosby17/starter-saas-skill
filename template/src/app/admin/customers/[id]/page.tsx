'use client'

import Link from 'next/link'
import { flagOf } from '@/lib/countries'
import { use, useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/choice'
import { useConfirm } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Notice, api } from '@/components/admin/kit'
import { Ban, Link2, Pencil, ShieldCheck, ShieldOff, UserCheck, Users } from 'lucide-react'
import { siWhatsapp } from 'simple-icons'
import { REQUEST_KINDS, type RequestKind } from '@/lib/catalog/types'
import { REQUEST_STATUS } from '@/lib/requests'
import { formatOrderAmount } from '@/lib/pricing/zones'
import { hasModule } from '@/config/site'
import { CreditAdjustmentForm } from '@/components/admin/CreditAdjustmentForm'
import { SuspendReasonMenu } from '@/components/admin/SuspendReasonMenu'
import { findSuspensionReason, type SuspensionReasonCode } from '@/lib/admin/suspension-reasons'

type Data = {
  profile: { id: string; email: string | null; full_name: string | null; phone: string | null; country: string | null; is_admin: boolean; is_internal?: boolean; suspension_reason?: string | null; suspended_at?: string | null; created_at: string }
  account: { suspended: boolean; last_sign_in_at: string | null }
  self: boolean
  entitlements: Array<{ id: string; product_id: string; source: string; created_at: string; revoked_at: string | null }>
  orders: Array<{ id: string; plan_name: string | null; amount_local: number; currency: string | null; payment_method: string | null; status: string; created_at: string }>
  requests: Array<{ id: string; kind: string; status: string; created_at: string }>
  products: Array<{ id: string; slug: string; title: string; external_url: string | null }>
}

const SOURCE: Record<string, string> = { purchase: 'Achat', admin: 'Donné par toi', import: 'Import' }

export default function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<Data | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [notify, setNotify] = useState(true)
  const [message, setMessage] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const [edit, setEdit] = useState<{ full_name: string; phone: string; country: string } | null>(null)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    const d = await api<Data>(`/api/admin/customers/${id}`)
    if (d.success) setData(d)
    else setMessage({ tone: 'red', text: d.message || 'Client introuvable.' })
  }, [id])
  useEffect(() => { load() }, [load])

  if (!data) return <main className="p-8 text-sm text-gray-500">{message?.text ?? 'Chargement…'}</main>
  const { profile } = data
  const titleOf = (pid: string) => data.products.find((p) => p.id === pid)?.title ?? 'Produit supprimé'
  const active = data.entitlements.filter((e) => !e.revoked_at)

  const grant = async () => {
    if (!picked.length) return
    const d = await api(`/api/admin/customers/${id}/access`, 'POST', { productIds: picked, notify })
    setMessage({ tone: d.success ? 'green' : 'red', text: d.message || (d.success ? 'Accès donné.' : 'Erreur.') })
    setPicked([])
    load()
  }
  const revoke = async (pid: string) => {
    if (!(await confirm({ title: `Retirer l’accès à « ${titleOf(pid)} » ?`, message: 'Le client ne verra plus ce produit. Tu peux le lui redonner à tout moment.', confirmLabel: 'Retirer', danger: true }))) return
    const d = await api(`/api/admin/customers/${id}/access`, 'DELETE', { productId: pid })
    setMessage({ tone: d.success ? 'green' : 'red', text: d.message || 'Fait.' })
    load()
  }
  const resend = async () => {
    const d = await api(`/api/admin/customers/${id}/resend`, 'POST')
    setMessage({ tone: d.success ? 'green' : 'red', text: d.message || 'Fait.' })
  }
  const patch = async (body: Record<string, unknown>) => {
    const d = await api(`/api/admin/customers/${id}`, 'PATCH', body)
    setMessage({ tone: d.success ? 'green' : 'red', text: d.message || (d.success ? 'Fait.' : 'Erreur.') })
    if (d.success) { setEdit(null); load() }
  }
  // Suspension : le motif se choisit dans un menu ; l'e-mail préétabli de ce motif part au client.
  const suspend = async (code: SuspensionReasonCode) => {
    const reason = findSuspensionReason(code)
    if (!(await confirm({ title: 'Suspendre ce compte ?', message: `Motif : « ${reason?.label} ». Le client ne pourra plus se connecter et reçoit l’e-mail de ce motif. Ses achats restent enregistrés ; tu peux le réactiver à tout moment.`, confirmLabel: 'Suspendre', danger: true }))) return
    patch({ suspended: true, reason_code: code })
  }
  const toggleInternal = () => patch({ is_internal: !profile.is_internal })
  const toggleAdmin = async () => {
    const next = !profile.is_admin
    if (!(await confirm({ title: next ? 'Nommer administrateur ?' : 'Retirer les droits d’administrateur ?', message: next ? 'Cette personne aura accès à toute l’administration : commandes, clients, paiements.' : 'Cette personne n’aura plus accès à l’administration.', confirmLabel: next ? 'Nommer admin' : 'Retirer', danger: next }))) return
    patch({ is_admin: next })
  }
  const name = profile.full_name || profile.email || 'Client'
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
  const paid = data.orders.filter((o) => o.status === 'success')
  const methods = [...new Set(paid.map((o) => o.payment_method).filter(Boolean))]
  const field = 'w-full rounded-xl border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <Link href="/admin/customers" className="text-sm text-gray-500 hover:text-gray-900">← Clients</Link>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <section className="rounded-3xl border border-gray-200 bg-surface p-6">
        <div className="flex flex-wrap items-start gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand text-xl font-semibold text-white" aria-hidden>{initials}</span>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-3xl">
              {name}
              {profile.is_admin && <Badge tone="amber">Admin</Badge>}
              {data.account.suspended && <Badge tone="red">Suspendu</Badge>}
              {profile.is_internal && <Badge>Interne</Badge>}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Client depuis le {new Date(profile.created_at).toLocaleDateString('fr-FR')}
              {data.account.last_sign_in_at ? ` · dernière connexion le ${new Date(data.account.last_sign_in_at).toLocaleDateString('fr-FR')}` : ' · jamais connecté'}
            </p>
            {data.account.suspended && (
              <p className="mt-1 text-sm text-red-700">
                Suspendu{profile.suspended_at ? ` le ${new Date(profile.suspended_at).toLocaleDateString('fr-FR')}` : ''}
                {profile.suspension_reason ? ` · motif : ${findSuspensionReason(profile.suspension_reason)?.label ?? profile.suspension_reason}` : ''}
              </p>
            )}
          </div>
        </div>

        {edit ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <label className="text-sm"><span className="mb-1 block text-gray-500">Nom</span><input className={field} value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></label>
            <label className="text-sm"><span className="mb-1 block text-gray-500">WhatsApp</span><input className={field} value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="+225…" /></label>
            <label className="text-sm"><span className="mb-1 block text-gray-500">Pays</span><input className={field} value={edit.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })} /></label>
            <div className="flex gap-2 sm:col-span-3">
              <Button onClick={() => patch(edit)} className="rounded-full">Enregistrer</Button>
              <Button variant="secondary" onClick={() => setEdit(null)} className="rounded-full">Annuler</Button>
            </div>
          </div>
        ) : (
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-4">
            <div><dt className="text-gray-500">E-mail</dt><dd className="mt-0.5 truncate"><a href={`mailto:${profile.email}`} className="hover:text-brand">{profile.email}</a></dd></div>
            <div><dt className="text-gray-500">WhatsApp</dt><dd className="mt-0.5">{profile.phone || '—'}</dd></div>
            <div><dt className="text-gray-500">Pays</dt><dd className="mt-0.5">{profile.country ? <>{flagOf(profile.country)} {profile.country}</> : '—'}</dd></div>
            <div><dt className="text-gray-500">A payé par</dt><dd className="mt-0.5">{methods.length ? methods.join(', ') : '—'}</dd></div>
          </dl>
        )}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-200 pt-5">
          {profile.phone && (
            <a href={`https://wa.me/${profile.phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:opacity-90"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden><path d={siWhatsapp.path} /></svg>WhatsApp</a>
          )}
          <button type="button" onClick={resend} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"><Link2 className="h-4 w-4" />Envoyer un lien de connexion</button>
          {!edit && <button type="button" onClick={() => setEdit({ full_name: profile.full_name ?? '', phone: profile.phone ?? '', country: profile.country ?? '' })} className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm hover:border-gray-400"><Pencil className="h-4 w-4" />Modifier</button>}
          {!data.self && <button type="button" onClick={toggleAdmin} className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm hover:border-gray-400">{profile.is_admin ? <><ShieldOff className="h-4 w-4" />Retirer admin</> : <><ShieldCheck className="h-4 w-4" />Nommer admin</>}</button>}
          {!data.self && <button type="button" onClick={toggleInternal} className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm hover:border-gray-400"><Users className="h-4 w-4" />{profile.is_internal ? 'Retirer « interne »' : 'Compte interne'}</button>}
          {!data.self && (data.account.suspended
            ? <button type="button" onClick={() => patch({ suspended: false })} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"><UserCheck className="h-4 w-4" />Réactiver le compte</button>
            : <SuspendReasonMenu onPick={suspend} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"><Ban className="h-4 w-4" />Suspendre…</SuspendReasonMenu>)}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-surface p-5">
        <h2 className="text-xl">Accès</h2>
        {active.length ? (
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
            {active.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="font-medium">{titleOf(e.product_id)}</span>
                <Badge>{SOURCE[e.source] ?? e.source}</Badge>
                <span className="text-xs text-gray-500">{new Date(e.created_at).toLocaleDateString('fr-FR')}</span>
                <button type="button" onClick={() => revoke(e.product_id)} className="ml-auto text-red-700 underline">Retirer</button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500">Aucun accès.</p>}
        <div className="space-y-3 pt-2">
          <p className="text-sm font-medium">Donner des accès (coche-en plusieurs)</p>
          <div className="grid gap-x-6 gap-y-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
            {data.products.filter((p) => !p.external_url && !active.some((e) => e.product_id === p.id)).map((p) => (
              <Checkbox key={p.id} checked={picked.includes(p.id)} onChange={(v) => setPicked((x) => (v ? [...x, p.id] : x.filter((y) => y !== p.id)))} label={p.title} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Checkbox checked={notify} onChange={setNotify} label="Prévenir le client par e-mail (« Ton accès est prêt »)" />
            <Button onClick={grant} disabled={!picked.length} className="ml-auto rounded-full">Donner {picked.length > 1 ? `les ${picked.length} accès` : 'l’accès'}</Button>
          </div>
        </div>
        <p className="text-xs text-gray-500">Pour un paiement reçu à la main (WhatsApp, Binance…), tu peux aussi valider sa commande dans Commandes.</p>
      </section>

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-surface p-5">
        <h2 className="text-xl">Commandes</h2>
        {data.orders.length ? (
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 text-sm">
            {data.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="text-gray-500">{new Date(o.created_at).toLocaleDateString('fr-FR')}</span>
                <span>{o.plan_name}</span>
                <span>{formatOrderAmount(o.amount_local, o.currency)}</span>
                <span className="text-gray-500">{o.payment_method}</span>
                <Badge tone={o.status === 'success' ? 'green' : o.status === 'pending' ? 'amber' : 'gray'}>{o.status === 'success' ? 'Payée' : o.status === 'pending' ? 'En attente' : o.status}</Badge>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500">Aucune commande.</p>}
      </section>

      {data.requests.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-gray-200 bg-surface p-5">
          <h2 className="text-xl">Demandes</h2>
          {data.requests.map((r) => (
            <Link key={r.id} href={`/admin/requests/${r.id}`} className="flex items-center gap-3 text-sm hover:text-brand">
              <span>{REQUEST_KINDS[r.kind as RequestKind] ?? r.kind}</span>
              <Badge tone={REQUEST_STATUS[r.status]?.tone ?? 'gray'}>{REQUEST_STATUS[r.status]?.label ?? r.status}</Badge>
              <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
            </Link>
          ))}
        </section>
      )}
      {hasModule('credits') && (
        <section className="space-y-3 rounded-2xl border border-gray-200 bg-surface p-5">
          <h2 className="text-lg font-medium">Crédits</h2>
          <p className="text-sm text-gray-500">Ajoute (nombre positif) ou retire (nombre négatif) des crédits. Le motif est journalisé et montré au client, qui est prévenu à sa prochaine visite.</p>
          <CreditAdjustmentForm userId={id} />
        </section>
      )}
    </main>
  )
}
