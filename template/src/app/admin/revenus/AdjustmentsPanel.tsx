'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/choice'
import { DatePicker } from '@/components/ui/date-picker'
import { Modal } from '@/components/ui/modal'
import { useConfirm } from '@/components/ui/dialog'
import { Field, Notice, api } from '@/components/admin/kit'
import { useAdminCurrency } from '@/components/admin/AdminCurrency'
import { ADJUSTMENT_REASONS, reasonInfo, type AdjustmentReason } from '@/lib/finance/adjustments'
import { CURRENCIES, type Currency } from '@/lib/finance/money'
import { TZ_OFFSET_MS } from '@/lib/time'
import type { RevenueReport } from '@/lib/finance/revenue'
import { Card, Kpi } from './ui'

// Mouvements d'argent hors passerelle, chacun avec son motif : vente manuelle, collaboration, don, correction,
// remboursement, reprises… La page en tire l'encaissé hors passerelle, le manque à gagner et « qui a reçu quoi ».

type Period = RevenueReport['period']
const n = (v: number) => Math.round(v).toLocaleString('fr-FR')
const today = () => new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10)

export function AdjustmentsPanel({ period, onChange }: { period: Period; onChange: () => void }) {
  const { format } = useAdminCurrency()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const a = period.adjustments
  const kind = (k: AdjustmentReason) => a.byReason[k] ?? { count: 0, credits: 0, paid: 0, catalog: 0, discount: 0 }
  const shortfall = kind('don').discount + kind('collaboration').discount + kind('vente_manuelle').discount
  const removals = ADJUSTMENT_REASONS.filter((r) => r.direction === 'retrait' && a.byReason[r.value])

  const remove = async (id: string) => {
    const ok = await confirm({ title: 'Supprimer ce mouvement ?', message: 'Il sort du pilotage. Les crédits éventuellement versés restent sur le compte : faites un « Autre retrait » pour les reprendre.', confirmLabel: 'Supprimer', danger: true })
    if (!ok) return
    const res = await api(`/api/admin/finance/adjustments/${id}`, 'DELETE')
    if (!res.success) return setError(res.message || 'Suppression impossible.')
    setError(null)
    onChange()
  }

  return (
    <Card title="Hors passerelle : dons, collaborations, retraits" subtitle="Ajouts et retraits manuels de la période, avec leur motif · valeur au prix du site"
      action={<Button type="button" onClick={() => setOpen(true)}>Nouveau mouvement</Button>}>
      {error && <div className="mb-3"><Notice tone="red">{error}</Notice></div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Ventes manuelles" value={format(kind('vente_manuelle').paid)} hint={`${kind('vente_manuelle').count} · remise ${format(kind('vente_manuelle').discount)}`} />
        <Kpi label="Collaborations" value={format(kind('collaboration').paid)} hint={`${kind('collaboration').count} · prix du site ${format(kind('collaboration').catalog)}`} />
        <Kpi label="Dons" value={`${n(kind('don').credits)} cr.`} hint={`${kind('don').count} don${kind('don').count > 1 ? 's' : ''} · valeur ${format(kind('don').catalog)}`} />
        <Kpi label="Manque à gagner" value={format(shortfall)} hint="dons + remises, comparés au prix du site" />
      </div>
      {(removals.length > 0 || a.refunds > 0) && (
        <p className="mt-3 text-sm text-gray-600">
          Retraits : {removals.map((r) => `${r.label} ${a.byReason[r.value].count}${a.byReason[r.value].credits ? ` (${n(a.byReason[r.value].credits)} cr.)` : ''}`).join(' · ')}
          {a.refunds > 0 ? ` · ${format(a.refunds)} rendus` : ''}
        </p>
      )}

      {a.list.length === 0 ? <p className="mt-4 text-sm text-gray-500">Aucun mouvement manuel sur la période.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-medium">Date</th><th className="py-2 pr-3 font-medium">Qui</th><th className="py-2 pr-3 font-medium">Motif</th>
                <th className="py-2 pr-3 text-right font-medium">Crédits</th><th className="py-2 pr-3 text-right font-medium">Prix du site</th>
                <th className="py-2 pr-3 text-right font-medium">Encaissé</th><th className="py-2 font-medium"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {a.list.map((m) => {
                const info = reasonInfo(m.reason)
                return (
                  <tr key={m.id} className="border-t border-gray-200 align-top">
                    <td className="whitespace-nowrap py-2 pr-3 text-gray-600">{new Date(m.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
                    <td className="max-w-[200px] py-2 pr-3">
                      {m.userId ? <Link href={`/admin/customers/${m.userId}`} className="block truncate hover:text-brand hover:underline">{m.who || 'Client'}</Link> : <span className="block truncate">{m.who || '—'}</span>}
                      {(m.method || m.note) && <span className="block truncate text-xs text-gray-500">{[m.method, m.note].filter(Boolean).join(' · ')}</span>}
                    </td>
                    <td className={info?.direction === 'retrait' ? 'py-2 pr-3 text-red-700' : 'py-2 pr-3'}>{info?.label ?? m.reason}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{m.credits ? `${info?.direction === 'retrait' ? '−' : ''}${n(m.credits)}` : '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-gray-600">{m.catalog ? format(m.catalog) : '—'}</td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums">{m.paid ? `${info?.money === 'out' ? '−' : ''}${format(m.paid)}` : '—'}</td>
                    <td className="py-2 text-right"><button type="button" onClick={() => remove(m.id)} className="text-xs text-red-700 hover:underline">Supprimer</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && <AdjustmentModal onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChange() }} />}
    </Card>
  )
}

function AdjustmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    reason: 'vente_manuelle' as AdjustmentReason, email: '', customer_label: '', credits: '', apply_credits: false,
    paid_amount: '', paid_currency: 'XAF' as Currency, list_price_fcfa: '', payment_method: '', note: '', occurred_on: today(),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof f>) => setF((cur) => ({ ...cur, ...patch }))
  const info = reasonInfo(f.reason)!
  const takesMoney = info.money !== 'none'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await api('/api/admin/finance/adjustments', 'POST', {
      ...f, paid_amount: takesMoney ? f.paid_amount || '0' : '0', list_price_fcfa: f.list_price_fcfa === '' ? null : f.list_price_fcfa,
    })
    setBusy(false)
    if (!res.success) return setError(res.message || 'Enregistrement impossible.')
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title="Nouveau mouvement hors passerelle" subtitle="Dites pourquoi : c’est ce qui sépare le chiffre d’affaires du manque à gagner."
      footer={<><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" form="adjustment-form" disabled={busy}>{busy ? 'Un instant…' : 'Enregistrer'}</Button></>}>
      <form id="adjustment-form" onSubmit={submit} className="space-y-3">
        <Field label="Motif" hint={info.hint}>
          <Select value={f.reason} onChange={(v) => set({ reason: v as AdjustmentReason })}
            options={ADJUSTMENT_REASONS.map((r) => ({ value: r.value, label: r.label, hint: r.direction === 'retrait' ? 'retrait' : undefined }))} />
        </Field>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="E-mail du compte (facultatif)"><Input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="client@exemple.com" /></Field>
          <Field label="Ou nom affiché"><Input value={f.customer_label} onChange={(e) => set({ customer_label: e.target.value })} placeholder="Partenaire, client hors site…" maxLength={120} /></Field>
        </div>
        <Field label="Crédits (facultatif)" hint="Laissez vide pour un accès ou un service.">
          <Input value={f.credits} onChange={(e) => set({ credits: e.target.value })} inputMode="numeric" placeholder="0" />
        </Field>
        {f.email && f.credits && (
          <Switch checked={f.apply_credits} onChange={(v) => set({ apply_credits: v })} label={info.direction === 'retrait' ? 'Reprendre ces crédits sur le compte' : 'Verser ces crédits sur le compte'} />
        )}
        {takesMoney && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label={info.money === 'out' ? 'Montant rendu' : 'Montant encaissé'}><Input value={f.paid_amount} onChange={(e) => set({ paid_amount: e.target.value })} inputMode="decimal" placeholder="0" /></Field>
            <Field label="Devise"><Select value={f.paid_currency} onChange={(v) => set({ paid_currency: v as Currency })} options={CURRENCIES.map((c) => ({ value: c.value, label: c.symbol }))} className="w-28" /></Field>
          </div>
        )}
        <Field label="Valeur au prix du site, en FCFA (facultatif)" hint="Vide : calculée d’après les packs de crédits publiés.">
          <Input value={f.list_price_fcfa} onChange={(e) => set({ list_price_fcfa: e.target.value })} inputMode="numeric" />
        </Field>
        <div className="grid gap-2 sm:grid-cols-2">
          {takesMoney && <Field label="Canal (facultatif)"><Input value={f.payment_method} onChange={(e) => set({ payment_method: e.target.value })} placeholder="Espèces, dépôt direct…" maxLength={60} /></Field>}
          <div className="text-sm"><span className="mb-1.5 block text-gray-600">Date</span><DatePicker value={f.occurred_on} max={today()} onChange={(v) => set({ occurred_on: v })} /></div>
        </div>
        <Field label="Note (facultatif)"><Input value={f.note} onChange={(e) => set({ note: e.target.value })} maxLength={500} /></Field>
        {error && <Notice tone="red">{error}</Notice>}
      </form>
    </Modal>
  )
}
