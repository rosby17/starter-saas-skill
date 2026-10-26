'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/choice'
import { DatePicker } from '@/components/ui/date-picker'
import { Modal } from '@/components/ui/modal'
import { useConfirm } from '@/components/ui/dialog'
import { Field, Notice, api } from '@/components/admin/kit'
import { useAdminCurrency } from '@/components/admin/AdminCurrency'
import { CURRENCIES, type Currency } from '@/lib/finance/money'
import { rateLabel, type ChargeLine, type ChargeRow, type FeeRateRow, type ProviderRateRow } from '@/lib/finance/charges'
import { TZ_OFFSET_MS } from '@/lib/time'
import type { RevenueReport } from '@/lib/finance/revenue'
import { Card } from './ui'

// Charges et marge réelle, en trois familles réglées séparément :
//  1. fixes (abonnements), 2. variables (fournisseurs à l'usage + frais de paiement, tarifs DATÉS), 3. ponctuelles.
// Le coût d'un fournisseur n'est JAMAIS saisi : il est calculé d'après son usage réel (provider_usage) et son tarif.

type Margin = RevenueReport['period']['margin']
const today = () => new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10)
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const nativeMoney = (amount: number, currency: Currency) =>
  `${Number(amount).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${currency === 'XAF' ? 'FCFA' : currency === 'EUR' ? '€' : '$'}`
const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c.value, label: c.symbol }))
const UNIT_SIZES = [
  { value: '1', label: 'l’unité' }, { value: '1000', label: 'les 1 000' }, { value: '1000000', label: 'le million' },
]

// ─── Synthèse de la marge ────────────────────────────────────────────────────

export function MarginCard({ margin, from, to }: { margin: Margin; from: string; to: string }) {
  const { format } = useAdminCurrency()
  const positive = margin.net >= 0
  return (
    <Card title="Marge réelle" subtitle={`Ce que l’on gagne vraiment du ${shortDate(from)} au ${shortDate(to)}, toutes charges déduites`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Big label="Entrées" value={format(margin.income)} hint={`ventes ${format(margin.revenue)}${margin.manualIn ? ` + hors passerelle ${format(margin.manualIn)}` : ''}${margin.refunds ? ` − remboursements ${format(margin.refunds)}` : ''}`} />
        <Big label="Charges" value={format(margin.chargesTotal)} hint={`${margin.income > 0 ? Math.round((margin.chargesTotal / margin.income) * 100) : 0} % des entrées`} />
        <Big label="Marge nette" value={format(margin.net)} hint={margin.netPct === null ? '—' : `${Math.round(margin.netPct)} % des entrées`} tone={positive ? 'green' : 'red'} />
      </div>

      {margin.variableError && <div className="mt-3"><Notice tone="red">Coût des fournisseurs non calculé (lecture de l’usage impossible) : la marge est surestimée.</Notice></div>}
      {margin.unpriced.length > 0 && <div className="mt-3"><Notice tone="red">Usage sans tarif en vigueur : {margin.unpriced.join(', ')}. Ajoutez un tarif daté ci-dessous, sinon ce coût compte pour zéro.</Notice></div>}
      {margin.missing.length > 0 && <div className="mt-3"><Notice>Montant non renseigné : {margin.missing.join(', ')} (marquez « gratuit » si c’est le cas).</Notice></div>}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Family title="Charges fixes" total={margin.fixedTotal} lines={margin.fixed} empty="Aucun abonnement saisi." render={(l) => l.free ? 'gratuit' : l.missing ? 'à renseigner' : format(l.fcfa)} />
        <Family title="Fournisseurs (calculés d’après l’usage)" total={margin.variableTotal} lines={margin.variable} empty="Aucun usage noté sur la période."
          detail={(l) => `${Math.round(l.units ?? 0).toLocaleString('fr-FR')} ${l.unit ?? ''}`} render={(l) => format(l.fcfa)} />
        <Family title="Frais de paiement" total={margin.feesTotal} lines={margin.fees} empty="Aucune vente."
          detail={(l) => `${(l.rate ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % de ${format(l.revenue ?? 0)}`} render={(l) => format(l.fcfa)} />
        <Family title="Charges ponctuelles" total={margin.oneOffTotal} lines={margin.oneOff} empty="Aucune dépense ponctuelle." render={(l) => format(l.fcfa)} />
      </div>
    </Card>
  )
}

function Big({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'green' | 'red' }) {
  return (
    <div className={clsx('min-w-0 rounded-xl border p-4', tone === 'green' ? 'border-green-200 bg-green-50' : tone === 'red' ? 'border-red-200 bg-red-50' : 'border-gray-200')}>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={clsx('mt-1 truncate text-2xl font-medium', tone === 'green' && 'text-green-700', tone === 'red' && 'text-red-700')}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  )
}

function Family({ title, total, lines, empty, render, detail }: {
  title: string; total: number; lines: ChargeLine[]; empty: string; render: (l: ChargeLine) => string; detail?: (l: ChargeLine) => string
}) {
  const { format } = useAdminCurrency()
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 border-b border-gray-200 pb-1.5 text-sm">
        <span className="font-medium">{title}</span><span className="font-medium tabular-nums">{format(total)}</span>
      </div>
      {lines.length === 0 ? <p className="pt-2 text-xs text-gray-500">{empty}</p> : (
        <ul className="divide-y divide-gray-200 text-sm">
          {lines.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="min-w-0"><span className="block truncate">{l.label}</span>{detail && <span className="block text-xs text-gray-500">{detail(l)}</span>}</span>
              <span className={clsx('shrink-0 tabular-nums', l.missing ? 'text-amber-700' : l.free ? 'text-gray-500' : '')}>{render(l)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Réglages des charges ────────────────────────────────────────────────────

type Settings = { charges: ChargeRow[]; providerRates: ProviderRateRow[]; feeRates: FeeRateRow[]; methods: string[]; providers: { provider: string; service: string }[] }
type Editing =
  | { kind: 'charge'; family: 'fixe' | 'ponctuelle'; row?: ChargeRow }
  | { kind: 'provider_rate'; preset?: Partial<ProviderRateRow> }
  | { kind: 'fee_rate'; preset?: Partial<FeeRateRow> }

export function ChargesPanel({ onSaved }: { onSaved: () => void }) {
  const confirm = useConfirm()
  const [data, setData] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [tab, setTab] = useState<'fixe' | 'variable' | 'ponctuelle'>('fixe')

  const load = useCallback(async () => {
    const res = await api<Settings>('/api/admin/finance/charges')
    if (res.success) { setData(res); setError(null) } else setError(res.message || 'Lecture impossible.')
  }, [])
  useEffect(() => { void load() }, [load])

  const saved = async () => { setEditing(null); await load(); onSaved() }
  const remove = async (type: 'charge' | 'provider_rate' | 'fee_rate', id: string, what: string) => {
    const ok = await confirm({
      title: `Supprimer ${what} ?`,
      message: type === 'charge' ? 'La charge disparaît de toutes les périodes, passées comprises.' : 'Les périodes concernées seront recalculées avec la version précédente du tarif. Pour un nouveau prix, ajoutez plutôt une version datée.',
      confirmLabel: 'Supprimer', danger: true,
    })
    if (!ok) return
    const res = await api(`/api/admin/finance/charges/${id}?type=${type}`, 'DELETE')
    if (!res.success) return setError(res.message || 'Suppression impossible.')
    await load(); onSaved()
  }

  const day = today()
  const groupedRates = useMemo(() => groupBy(data?.providerRates ?? [], (r) => `${r.provider}|${r.service}`), [data])
  const groupedFees = useMemo(() => groupBy(data?.feeRates ?? [], (r) => r.method.trim().toLowerCase()), [data])
  const missingProviders = (data?.providers ?? []).filter((p) => !(data?.providerRates ?? []).some((r) => r.provider === p.provider && (r.service === p.service || r.service === '')))

  return (
    <Card title="Réglages des charges" subtitle="Trois familles. Un tarif ne se modifie pas : on ajoute une version datée, l’historique de la marge reste juste.">
      {error && <div className="mb-3"><Notice tone="red">{error}</Notice></div>}
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1" role="tablist">
        {([['fixe', 'Fixes'], ['variable', 'Variables'], ['ponctuelle', 'Ponctuelles']] as const).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={clsx('shrink-0 rounded-full px-3 py-1 text-sm', tab === v ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>{l}</button>
        ))}
      </div>
      {!data ? <p className="text-sm text-gray-500">Chargement…</p> : (
        <>
          {tab === 'fixe' && (
            <Section text="Abonnements : serveur, nom de domaine, outils, électricité… Un annuel est réparti sur 12 mois ; une dépense partagée compte pour sa part."
              action={<Button type="button" onClick={() => setEditing({ kind: 'charge', family: 'fixe' })}>Ajouter un abonnement</Button>}>
              <ChargeList rows={data.charges.filter((c) => c.family === 'fixe')} onEdit={(row) => setEditing({ kind: 'charge', family: 'fixe', row })} onDelete={(row) => remove('charge', row.id, `« ${row.label} »`)} />
            </Section>
          )}
          {tab === 'ponctuelle' && (
            <Section text="Dépenses imprévues d’un jour donné : matériel, prestation, publicité…"
              action={<Button type="button" onClick={() => setEditing({ kind: 'charge', family: 'ponctuelle' })}>Ajouter une dépense</Button>}>
              <ChargeList rows={data.charges.filter((c) => c.family === 'ponctuelle')} onEdit={(row) => setEditing({ kind: 'charge', family: 'ponctuelle', row })} onDelete={(row) => remove('charge', row.id, `« ${row.label} »`)} />
            </Section>
          )}
          {tab === 'variable' && (
            <div className="space-y-6">
              <Section text="Fournisseurs payés à l’usage. Le coût = usage réel noté par le code (recordProviderUsage) × tarif en vigueur le jour de l’appel. Toujours préciser l’unité : « 5 $ pour le million de caractères », pas « 5 $ »."
                action={<Button type="button" onClick={() => setEditing({ kind: 'provider_rate' })}>Nouveau tarif</Button>}>
                {missingProviders.length > 0 && (
                  <div className="mb-3"><Notice tone="red">
                    Usage noté sans tarif : {missingProviders.map((p) => (
                      <button key={`${p.provider}|${p.service}`} type="button" className="mr-2 underline" onClick={() => setEditing({ kind: 'provider_rate', preset: { provider: p.provider, service: p.service } })}>
                        {p.provider}{p.service ? ` · ${p.service}` : ''}
                      </button>
                    ))}
                  </Notice></div>
                )}
                {groupedRates.length === 0 ? <p className="text-sm text-gray-500">Aucun tarif de fournisseur.</p> : (
                  <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
                    {groupedRates.map(([key, versions]) => {
                      const current = versions.find((v) => v.valid_from <= day)
                      const first = versions[0]
                      return (
                        <li key={key} className="space-y-1.5 p-3 text-sm">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="min-w-0 font-medium">{first.label || first.provider}{first.service ? <span className="text-gray-500"> · {first.service}</span> : <span className="text-gray-500"> · tous services</span>}</span>
                            <button type="button" className="text-xs text-brand hover:underline" onClick={() => setEditing({ kind: 'provider_rate', preset: { ...(current ?? first), valid_from: day } })}>Changer le tarif</button>
                          </div>
                          <p className="text-gray-600">{current ? `En vigueur : ${rateLabel(current)}` : 'Pas encore en vigueur'}</p>
                          <Versions items={versions.map((v) => ({ id: v.id, from: v.valid_from, text: rateLabel(v) }))} onDelete={(id) => remove('provider_rate', id, 'cette version du tarif')} />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>
              <Section text="Frais de paiement : un pourcentage de chaque vente, par canal. « * » = taux appliqué à un canal sans taux propre."
                action={<Button type="button" variant="secondary" onClick={() => setEditing({ kind: 'fee_rate' })}>Nouveau taux</Button>}>
                {groupedFees.length === 0 ? <p className="text-sm text-gray-500">Aucun frais saisi : les ventes comptent sans frais.</p> : (
                  <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
                    {groupedFees.map(([key, versions]) => {
                      const current = versions.find((v) => v.valid_from <= day)
                      return (
                        <li key={key} className="space-y-1.5 p-3 text-sm">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-medium">{versions[0].method === '*' ? 'Par défaut (*)' : versions[0].method}</span>
                            <button type="button" className="text-xs text-brand hover:underline" onClick={() => setEditing({ kind: 'fee_rate', preset: { method: versions[0].method, percent: current?.percent, valid_from: day } })}>Changer le taux</button>
                          </div>
                          <p className="text-gray-600">{current ? `En vigueur : ${Number(current.percent).toLocaleString('fr-FR')} %` : 'Pas encore en vigueur'}</p>
                          <Versions items={versions.map((v) => ({ id: v.id, from: v.valid_from, text: `${Number(v.percent).toLocaleString('fr-FR')} %` }))} onDelete={(id) => remove('fee_rate', id, 'cette version du taux')} />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>
            </div>
          )}
        </>
      )}

      {editing?.kind === 'charge' && <ChargeModal family={editing.family} row={editing.row} onClose={() => setEditing(null)} onSaved={saved} />}
      {editing?.kind === 'provider_rate' && <ProviderRateModal preset={editing.preset} onClose={() => setEditing(null)} onSaved={saved} />}
      {editing?.kind === 'fee_rate' && <FeeRateModal preset={editing.preset} methods={data?.methods ?? []} onClose={() => setEditing(null)} onSaved={saved} />}
    </Card>
  )
}

function groupBy<T extends { valid_from: string }>(rows: T[], key: (r: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>()
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r])
  return [...map.entries()].map(([k, v]) => [k, v.sort((a, b) => b.valid_from.localeCompare(a.valid_from))])
}

function Section({ text, action, children }: { text: string; action: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 max-w-2xl flex-1 text-sm text-gray-600">{text}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function Versions({ items, onDelete }: { items: { id: string; from: string; text: string }[]; onDelete: (id: string) => void }) {
  return (
    <ul className="space-y-0.5 text-xs text-gray-500">
      {items.map((v) => (
        <li key={v.id} className="flex flex-wrap items-center gap-x-2">
          <span>à partir du {shortDate(v.from)} : {v.text}</span>
          <button type="button" onClick={() => onDelete(v.id)} className="text-red-700 hover:underline">supprimer</button>
        </li>
      ))}
    </ul>
  )
}

function ChargeList({ rows, onEdit, onDelete }: { rows: ChargeRow[]; onEdit: (r: ChargeRow) => void; onDelete: (r: ChargeRow) => void }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">Rien pour le moment.</p>
  return (
    <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-medium">{r.label}</span>
            <span className="block text-xs text-gray-500">
              {r.free && !r.amount ? 'gratuit' : `${nativeMoney(r.amount, r.currency)}${r.period === 'monthly' ? ' par mois' : r.period === 'yearly' ? ' par an' : ''}`}
              {Number(r.share_pct) < 100 ? ` · part imputée ${Number(r.share_pct)} %` : ''}
              {r.family === 'ponctuelle' && r.starts_on ? ` · le ${shortDate(r.starts_on)}` : ''}
              {r.family === 'fixe' && r.starts_on ? ` · depuis le ${shortDate(r.starts_on)}` : ''}
              {r.ends_on ? ` · jusqu’au ${shortDate(r.ends_on)}` : ''}
            </span>
          </span>
          <span className="flex shrink-0 gap-1">
            <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => onEdit(r)}>Modifier</Button>
            <Button type="button" variant="ghost" className="px-2 py-1 text-xs text-red-700" onClick={() => onDelete(r)}>Supprimer</Button>
          </span>
        </li>
      ))}
    </ul>
  )
}

function ModalFooter({ busy, onClose, label = 'Enregistrer', form }: { busy: boolean; onClose: () => void; label?: string; form: string }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
      <Button type="submit" form={form} disabled={busy}>{busy ? 'Un instant…' : label}</Button>
    </div>
  )
}

function ChargeModal({ family, row, onClose, onSaved }: { family: 'fixe' | 'ponctuelle'; row?: ChargeRow; onClose: () => void; onSaved: () => void }) {
  // Fenêtre pré-remplie avec les valeurs en place (ou les valeurs par défaut).
  const [f, setF] = useState({
    label: row?.label ?? '', amount: row ? String(row.amount) : '', currency: (row?.currency ?? 'XAF') as Currency,
    period: row?.period ?? (family === 'fixe' ? 'monthly' : 'once'), share_pct: String(row?.share_pct ?? 100), free: row?.free ?? false,
    starts_on: row?.starts_on ?? (family === 'ponctuelle' ? today() : ''), ends_on: row?.ends_on ?? '', note: row?.note ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof f>) => setF((cur) => ({ ...cur, ...patch }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const data = { ...f, family, amount: f.amount || '0', share_pct: f.share_pct || '100' }
    const res = row ? await api(`/api/admin/finance/charges/${row.id}`, 'PATCH', { data }) : await api('/api/admin/finance/charges', 'POST', { type: 'charge', data })
    setBusy(false)
    if (!res.success) return setError(res.message || 'Enregistrement impossible.')
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title={row ? 'Modifier la charge' : family === 'fixe' ? 'Nouvel abonnement' : 'Nouvelle dépense ponctuelle'} footer={<ModalFooter busy={busy} onClose={onClose} form="charge-form" />}>
      <form id="charge-form" onSubmit={submit} className="space-y-3">
        <Field label="Nom"><Input value={f.label} onChange={(e) => set({ label: e.target.value })} placeholder={family === 'fixe' ? 'Serveur, nom de domaine…' : 'Micro, prestation…'} required maxLength={120} /></Field>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label="Montant"><Input value={f.amount} onChange={(e) => set({ amount: e.target.value })} inputMode="decimal" placeholder="0" /></Field>
          <Field label="Devise"><Select value={f.currency} onChange={(v) => set({ currency: v as Currency })} options={CURRENCY_OPTIONS} className="w-28" /></Field>
        </div>
        {family === 'fixe' && (
          <Field label="Fréquence">
            <Select value={f.period} onChange={(v) => set({ period: v as 'monthly' | 'yearly' })} options={[{ value: 'monthly', label: 'Par mois' }, { value: 'yearly', label: 'Par an (réparti sur 12 mois)' }]} />
          </Field>
        )}
        <Field label="Part imputée au produit (%)" hint="Une dépense partagée avec d’autres activités : 20 % = un cinquième compte ici.">
          <Input value={f.share_pct} onChange={(e) => set({ share_pct: e.target.value })} inputMode="decimal" />
        </Field>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="text-sm"><span className="mb-1 block text-gray-600">{family === 'fixe' ? 'Depuis le (facultatif)' : 'Date de la dépense'}</span><DatePicker value={f.starts_on} onChange={(v) => set({ starts_on: v })} /></div>
          {family === 'fixe' && <div className="text-sm"><span className="mb-1 block text-gray-600">Jusqu’au (facultatif)</span><DatePicker value={f.ends_on} min={f.starts_on || undefined} onChange={(v) => set({ ends_on: v })} /></div>}
        </div>
        {family === 'fixe' && <Switch checked={f.free} onChange={(v) => set({ free: v })} label="Gratuit pour le moment (affiché « gratuit », pas « à renseigner »)" />}
        <Field label="Note (facultatif)"><Input value={f.note} onChange={(e) => set({ note: e.target.value })} maxLength={500} /></Field>
        {error && <Notice tone="red">{error}</Notice>}
      </form>
    </Modal>
  )
}

function ProviderRateModal({ preset, onClose, onSaved }: { preset?: Partial<ProviderRateRow>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    provider: preset?.provider ?? '', service: preset?.service ?? '', label: preset?.label ?? '',
    amount: preset?.amount !== undefined ? String(preset.amount) : '', currency: (preset?.currency ?? 'USD') as Currency,
    per_units: String(preset?.per_units ?? 1_000_000), unit: preset?.unit ?? 'caractères', valid_from: preset?.valid_from ?? today(), note: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof f>) => setF((cur) => ({ ...cur, ...patch }))
  const custom = !UNIT_SIZES.some((u) => u.value === f.per_units)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await api('/api/admin/finance/charges', 'POST', { type: 'provider_rate', data: f })
    setBusy(false)
    if (!res.success) return setError(res.message || 'Enregistrement impossible.')
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title="Tarif d’un fournisseur" subtitle="Nouvelle version datée : les jours d’avant gardent l’ancien tarif." footer={<ModalFooter busy={busy} onClose={onClose} form="rate-form" />}>
      <form id="rate-form" onSubmit={submit} className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Identifiant du fournisseur" hint="Tel que noté dans provider_usage."><Input value={f.provider} onChange={(e) => set({ provider: e.target.value })} placeholder="fournisseur-a" required /></Field>
          <Field label="Service (facultatif)" hint="Vide = tous ses services."><Input value={f.service} onChange={(e) => set({ service: e.target.value })} placeholder="synthese" /></Field>
        </div>
        <Field label="Nom affiché (facultatif)"><Input value={f.label} onChange={(e) => set({ label: e.target.value })} placeholder="Fournisseur A · synthèse" maxLength={80} /></Field>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label="Prix"><Input value={f.amount} onChange={(e) => set({ amount: e.target.value })} inputMode="decimal" placeholder="5" required /></Field>
          <Field label="Devise"><Select value={f.currency} onChange={(v) => set({ currency: v as Currency })} options={CURRENCY_OPTIONS} className="w-28" /></Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Pour">
            <Select value={custom ? 'autre' : f.per_units} onChange={(v) => set({ per_units: v === 'autre' ? '100' : v })} options={[...UNIT_SIZES, { value: 'autre', label: 'Autre quantité' }]} />
          </Field>
          <Field label="Unité"><Input value={f.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="caractères, jetons, images, secondes" required maxLength={30} /></Field>
        </div>
        {custom && <Field label="Quantité"><Input value={f.per_units} onChange={(e) => set({ per_units: e.target.value })} inputMode="numeric" /></Field>}
        <div className="text-sm"><span className="mb-1 block text-gray-600">En vigueur à partir du</span><DatePicker value={f.valid_from} onChange={(v) => set({ valid_from: v })} /></div>
        {f.amount && <p className="text-xs text-gray-500">Soit : {rateLabel({ amount: Number(f.amount.replace(',', '.')) || 0, currency: f.currency, per_units: Number(f.per_units) || 1, unit: f.unit })}.</p>}
        {error && <Notice tone="red">{error}</Notice>}
      </form>
    </Modal>
  )
}

function FeeRateModal({ preset, methods, onClose, onSaved }: { preset?: Partial<FeeRateRow>; methods: string[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ method: preset?.method ?? '*', percent: preset?.percent !== undefined ? String(preset.percent) : '', valid_from: preset?.valid_from ?? today() })
  const [other, setOther] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const options = [{ value: '*', label: 'Par défaut (*)' }, ...[...new Set([...methods, ...(preset?.method && preset.method !== '*' ? [preset.method] : [])])].map((m) => ({ value: m, label: m })), { value: '__autre', label: 'Autre canal…' }]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await api('/api/admin/finance/charges', 'POST', { type: 'fee_rate', data: f })
    setBusy(false)
    if (!res.success) return setError(res.message || 'Enregistrement impossible.')
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title="Frais d’un canal de paiement" subtitle="Pourcentage retenu sur chaque vente, à partir d’une date." footer={<ModalFooter busy={busy} onClose={onClose} form="fee-form" />}>
      <form id="fee-form" onSubmit={submit} className="space-y-3">
        <Field label="Canal">
          <Select value={other ? '__autre' : f.method} onChange={(v) => { if (v === '__autre') { setOther(true); setF((c) => ({ ...c, method: '' })) } else { setOther(false); setF((c) => ({ ...c, method: v })) } }} options={options} />
        </Field>
        {other && <Field label="Nom du canal" hint="Tel qu’il apparaît dans les commandes."><Input value={f.method} onChange={(e) => setF((c) => ({ ...c, method: e.target.value }))} required maxLength={60} /></Field>}
        <Field label="Frais (%)"><Input value={f.percent} onChange={(e) => setF((c) => ({ ...c, percent: e.target.value }))} inputMode="decimal" placeholder="8" required /></Field>
        <div className="text-sm"><span className="mb-1 block text-gray-600">En vigueur à partir du</span><DatePicker value={f.valid_from} onChange={(v) => setF((c) => ({ ...c, valid_from: v }))} /></div>
        {error && <Notice tone="red">{error}</Notice>}
      </form>
    </Modal>
  )
}
