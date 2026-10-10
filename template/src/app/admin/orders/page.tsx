'use client'

import { useCallback, useEffect, useState } from 'react'
import { countryCode, flagOf } from '@/lib/countries'
import { clsx } from '@/lib/utils'
import { useConfirm } from '@/components/ui/dialog'
import { formatOrderAmount } from '@/lib/pricing/zones'
import { Select } from '@/components/ui/select'
import { siWhatsapp } from 'simple-icons'

type Order = {
  id: string; user_id: string; email: string | null; customer_name: string | null; customer_phone: string | null; customer_country: string | null
  plan_name: string | null; amount_local: number; amount_fcfa: number | null; paid_amount_fcfa: number | null; payment_note: string | null; is_test?: boolean; purchase_kind?: string; client_ip?: string | null; ip_country?: string | null; price_zone?: string | null; product?: { title: string; image: string | null } | null; currency: string; payment_method: string | null; payment_ref: string | null; status: string; created_at: string
}

// Couleurs des statuts (10/10) : payée en vert léger, en attente en jaune léger, annulée / échec en rouge.
// Abandonnée, expirée et annulée = le même échec pour l'admin : un seul libellé « Annulée ».
const RED = { badge: 'border-red-200 bg-red-50 text-red-800', card: 'border-l-red-500 bg-red-50/40' }
const STATUS: Record<string, { label: string; cls: string; card: string }> = {
  pending: { label: 'En attente', cls: 'border-amber-200 bg-amber-50 text-amber-800', card: 'border-l-amber-400 bg-amber-50/40' },
  success: { label: 'Payée', cls: 'border-green-200 bg-green-50 text-green-800', card: 'border-l-green-500 bg-green-50/40' },
  failed: { label: 'Annulée', cls: RED.badge, card: RED.card },
  expired: { label: 'Annulée (expirée)', cls: RED.badge, card: RED.card },
  cancelled: { label: 'Annulée', cls: RED.badge, card: RED.card },
  flagged_underpaid: { label: 'Montant insuffisant', cls: RED.badge, card: RED.card },
  flagged_reversal: { label: 'Remboursée / litige', cls: RED.badge, card: RED.card },
}
const FILTERS = [{ value: '', label: 'Toutes' }, { value: 'pending', label: 'En attente' }, { value: 'success', label: 'Payées' }, { value: 'cancelled', label: 'Annulées' }, { value: 'test', label: 'Tests' }]

const METHODS = ['Tara Money', 'Warappay', 'Binance', 'Orange Money', 'MTN Mobile Money', 'Wave', 'Moov Money', 'Virement bancaire', 'Espèces', 'Autre'].map((m) => ({ value: m, label: m }))
// Moyen proposé par défaut à la validation : celui de la commande (« Wave (manuel) » → Wave…), sinon « Autre ».
const methodOf = (pm: string | null) => METHODS.find((m) => m.value === pm)?.value
  ?? (/wave/i.test(pm ?? '') ? 'Wave' : /binance|usdt/i.test(pm ?? '') ? 'Binance' : /tara/i.test(pm ?? '') ? 'Tara Money' : /warappay/i.test(pm ?? '') ? 'Warappay' : 'Autre')
type Paid = { method: string; ref: string; amount: string; note: string }

const waLink = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, '')}`
const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Commandes : une carte par commande, alignée sur une grille ; actions claires (vérifier, valider, abandonner).
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [validating, setValidating] = useState<{ id: string; form: Paid } | null>(null)
  const [message, setMessage] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const confirm = useConfirm()
  // Filtre de départ passé dans l'adresse (liens de la vue d'ensemble : ?status=pending).
  useEffect(() => { const s = new URLSearchParams(window.location.search).get('status'); if (s) setStatus(s) }, [])

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) })
    if (status) params.set('status', status)
    if (q.trim()) params.set('q', q.trim())
    const res = await fetch(`/api/admin/orders?${params}`)
    const data = await res.json()
    if (data.success) { setOrders(data.orders); setTotal(data.total) } else setMessage({ tone: 'red', text: data.message })
  }, [page, status, q])
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t) }, [load])

  const act = async (o: Order, action: 'verify' | 'mark_failed' | 'mark_paid' | 'cancel' | 'mark_test' | 'unmark_test', paid?: Paid) => {
    if (action === 'cancel' && !(await confirm({ title: 'Annuler cette commande ?', message: 'Le client n’a pas payé : elle passe en rouge dans « Annulées » (et reste visible dans « Toutes »). Tu pourras encore la valider si l’argent arrive.', confirmLabel: 'Annuler la commande', danger: true }))) return
    if (action === 'mark_test' && !(await confirm({ title: 'Commande de test ?', message: 'Elle passe dans l’onglet « Tests » et ne comptera jamais dans les ventes ni les statistiques. L’accès éventuel du client est gardé.', confirmLabel: 'Marquer comme test' }))) return
    if (action === 'mark_failed' && !(await confirm({ title: 'Abandonner cette commande ?', message: 'Elle passe en « Abandonnée ». Tu pourras encore la valider plus tard si l’argent arrive.', confirmLabel: 'Abandonner', danger: true }))) return
    if (action === 'mark_paid' && !(await confirm({ title: 'Paiement bien reçu ?', message: `${o.customer_name || o.email} reçoit son accès à « ${o.plan_name} » et un e-mail avec son lien de connexion.`, confirmLabel: 'Valider et donner l’accès' }))) return
    setBusy(o.id)
    const body = action === 'mark_paid' && paid
      ? { action, method: paid.method, ref: paid.ref.trim() || undefined, amount_fcfa: paid.amount ? Number(paid.amount.replace(/[^\d]/g, '')) : undefined, note: paid.note.trim() || undefined }
      : { action }
    const res = await fetch(`/api/admin/orders/${o.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    setMessage({ tone: data.success === false ? 'red' : 'green', text: data.message || (data.credited ? 'Paiement validé : accès donné au client.' : data.state ? `Réponse de la passerelle : ${data.state}` : data.success ? 'Fait.' : 'Échec.') })
    setBusy(null)
    if (data.success !== false) setValidating(null)
    load()
  }
  const field = 'w-full rounded-xl border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-brand'

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="text-3xl md:text-4xl">Commandes</h1>
        <p className="mt-1 text-sm text-gray-500">{total} commande{total > 1 ? 's' : ''}{status ? ` · ${FILTERS.find((f) => f.value === status)?.label.toLowerCase()}` : ''}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-full border border-gray-200 bg-surface p-1" role="tablist">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" role="tab" aria-selected={status === f.value} onClick={() => { setPage(1); setStatus(f.value) }}
              className={clsx('rounded-full px-4 py-1.5 text-sm transition-colors', status === f.value ? 'bg-brand text-white' : 'text-gray-600 hover:text-gray-900')}>
              {f.label}
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} placeholder="Nom, e-mail, téléphone, référence…"
          className="w-full rounded-full border border-gray-200 bg-surface px-4 py-2 text-sm outline-none focus:border-brand sm:ml-auto sm:w-80" />
      </div>

      {message && <p className={clsx('rounded-2xl border px-4 py-3 text-sm', message.tone === 'green' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800')}>{message.text}</p>}

      <div className="space-y-3">
        {orders.length === 0 && <p className="rounded-2xl border border-gray-200 bg-surface p-8 text-center text-sm text-gray-500">Aucune commande.</p>}
        {orders.map((o) => {
          const st = STATUS[o.status] || { label: o.status, cls: 'border-gray-200 bg-gray-100 text-gray-600', card: '' }
          return (
            <article key={o.id} className={clsx('grid gap-4 rounded-2xl border border-l-4 border-gray-200 bg-surface p-5 md:grid-cols-[1.6fr_1.3fr_1fr_auto] md:items-center', st.card)}>
              <div className="flex min-w-0 items-center gap-4">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  {o.product?.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.product.image} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{o.plan_name || o.product?.title || '—'}</p>
                  <p className="mt-0.5 text-lg font-medium tracking-tight">{formatOrderAmount(o.amount_local, o.currency)}</p>
                  <p className="text-xs text-gray-500">{when(o.created_at)}{o.purchase_kind === 'deposit' ? ' · réservation 10 %' : o.purchase_kind === 'balance' ? ' · solde 60 %' : ''}</p>
                </div>
              </div>
              <div className="min-w-0 space-y-0.5 text-sm">
                <p className="truncate font-medium">{o.customer_name || '—'}</p>
                <p className="truncate text-gray-600">{o.email || '—'}</p>
                <p className="flex flex-wrap items-center gap-2 text-gray-600">
                  {o.customer_phone && <span>{o.customer_phone}</span>}
                  {o.customer_country && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{flagOf(o.customer_country)} {o.customer_country}</span>}
                </p>
              </div>
              <div className="space-y-1.5 text-sm">
                <span className={clsx('inline-block rounded-full border px-3 py-1 text-xs font-medium', st.cls)}>{st.label}</span>
                <p className="text-gray-600">{o.payment_method || '—'}</p>
                {o.payment_ref && <p className="truncate font-mono text-xs text-gray-500" title={o.payment_ref}>{o.payment_ref}</p>}
                {o.paid_amount_fcfa != null && o.status === 'success' && <p className="text-xs text-gray-500">Reçu : {o.paid_amount_fcfa.toLocaleString('fr-FR')} FCFA</p>}
                {o.payment_note && <p className="text-xs italic text-gray-500">{o.payment_note}</p>}
                {(o.ip_country || o.client_ip) && (() => {
                  const typed = countryCode(o.customer_country)
                  const mismatch = !!o.ip_country && !!typed && typed !== o.ip_country
                  return (
                    <p className={clsx('text-xs', mismatch ? 'text-amber-700' : 'text-gray-500')} title={o.client_ip ?? undefined}>
                      IP : {flagOf(o.ip_country)} {o.ip_country || '?'}{o.price_zone ? ` · zone ${o.price_zone === 'mobile_money_fcfa' ? 'Mobile Money (FCFA)' : o.price_zone}` : ''}
                      {mismatch && ' · pays différent du client (VPN ?)'}
                    </p>
                  )
                })()}
              </div>
              <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-stretch">
                <div className="flex gap-2 md:justify-end">
                  {o.customer_phone && (
                    <a href={waLink(o.customer_phone)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${o.customer_name || 'ce client'}`} title="Écrire sur WhatsApp"
                      className="grid h-10 w-10 place-items-center rounded-full bg-[#25D366] text-white hover:opacity-90">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d={siWhatsapp.path} /></svg>
                    </a>
                  )}
                  {o.is_test && <span className="self-center rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500">Test</span>}
                </div>
                {o.status === 'pending' && (
                  <>
                    <button type="button" disabled={busy === o.id} onClick={() => setValidating({ id: o.id, form: { method: methodOf(o.payment_method), ref: o.payment_ref ?? '', amount: String(o.amount_fcfa ?? ''), note: '' } })} className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60">Valider le paiement</button>
                    <button type="button" disabled={busy === o.id} onClick={() => act(o, 'verify')} className="rounded-full border border-gray-300 px-4 py-2 text-sm hover:border-gray-400 disabled:opacity-60">Vérifier</button>
                    <button type="button" disabled={busy === o.id} onClick={() => act(o, 'cancel')} className="rounded-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60">Annuler</button>
                  </>
                )}
                {['failed', 'expired', 'cancelled'].includes(o.status) && (
                  <>
                    <button type="button" disabled={busy === o.id} onClick={() => setValidating({ id: o.id, form: { method: methodOf(o.payment_method), ref: o.payment_ref ?? '', amount: String(o.amount_fcfa ?? ''), note: '' } })} className="rounded-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-60">L’argent est arrivé ?</button>
                    <button type="button" disabled={busy === o.id} onClick={() => act(o, o.is_test ? 'unmark_test' : 'mark_test')} className="rounded-full px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-60">{o.is_test ? 'Ce n’était pas un test' : 'C’était un test'}</button>
                  </>
                )}
                {o.status === 'success' && (
                  <>
                    <a href={`/billing/invoice/${o.id}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-gray-300 px-4 py-2 text-center text-sm hover:border-gray-400">Facture</a>
                    <button type="button" disabled={busy === o.id} onClick={() => act(o, o.is_test ? 'unmark_test' : 'mark_test')} className="rounded-full px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-60">{o.is_test ? 'Compter comme vente' : 'C’était un test'}</button>
                  </>
                )}
              </div>
              {validating?.id === o.id && (
                <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 md:col-span-4">
                  <p className="font-medium">Détail du paiement reçu</p>
                  <p className="mb-3 text-xs text-gray-500">Pour ta comptabilité : il apparaît dans Revenus et sur la facture.</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-sm"><span className="mb-1 block text-gray-500">Payé par</span>
                      <Select value={validating.form.method} onChange={(v) => setValidating({ ...validating, form: { ...validating.form, method: v } })} options={METHODS} /></label>
                    <label className="text-sm"><span className="mb-1 block text-gray-500">Référence / n° de transaction</span>
                      <input className={field} value={validating.form.ref} onChange={(e) => setValidating({ ...validating, form: { ...validating.form, ref: e.target.value } })} placeholder="Ex. ID Binance, n° Orange Money" /></label>
                    <label className="text-sm"><span className="mb-1 block text-gray-500">Montant reçu (FCFA)</span>
                      <input className={field} inputMode="numeric" value={validating.form.amount} onChange={(e) => setValidating({ ...validating, form: { ...validating.form, amount: e.target.value } })} /></label>
                    <label className="text-sm"><span className="mb-1 block text-gray-500">Note (facultatif)</span>
                      <input className={field} value={validating.form.note} onChange={(e) => setValidating({ ...validating, form: { ...validating.form, note: e.target.value } })} placeholder="Ex. payé en 2 fois" /></label>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" disabled={busy === o.id} onClick={() => act(o, 'mark_paid', validating.form)} className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60">Valider et donner l’accès</button>
                    <button type="button" onClick={() => setValidating(null)} className="rounded-full border border-gray-300 px-5 py-2 text-sm hover:border-gray-400">Annuler</button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {total > 25 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-full border border-gray-300 px-4 py-1.5 disabled:opacity-40">← Précédent</button>
          <span className="text-gray-500">Page {page}</span>
          <button disabled={page * 25 >= total} onClick={() => setPage(page + 1)} className="rounded-full border border-gray-300 px-4 py-1.5 disabled:opacity-40">Suivant →</button>
        </div>
      )}
    </main>
  )
}
