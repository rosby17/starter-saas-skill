'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Checkbox, Switch } from '@/components/ui/choice'
import { useConfirm } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Notice, api, inputClass } from '@/components/admin/kit'
import { CATEGORIES, REQUEST_KINDS, formatFcfa, type Product } from '@/lib/catalog/types'
import { LessonsEditor, type AdminLesson } from './LessonsEditor'
import { FilesEditor, type AdminFile } from './FilesEditor'
import { AnnouncePanel } from './AnnouncePanel'
import { TZ_ISO, TZ_OFFSET_MS } from '@/lib/time'

type Form = {
  slug: string; category: string; title: string; subtitle: string; description: string; features: string
  price_fcfa: string; compare_at_fcfa: string; promo_price_fcfa: string; promo_date: string; promo_time: string
  image: string; sales_url: string; external_url: string; request_kind: string; includes: string; published: boolean; preorder: boolean; position: string
  billing: string; period_days: string; covers_all: boolean; updates_for: string
  credits: string; credits_validity_days: string
}

const empty: Form = {
  slug: '', category: 'formation', title: '', subtitle: '', description: '', features: '', price_fcfa: '', compare_at_fcfa: '', promo_price_fcfa: '',
  promo_date: '', promo_time: '00:00', image: '', sales_url: '', external_url: '', request_kind: '', includes: '', published: false, preorder: false, position: '0',
  billing: 'one_time', period_days: '30', covers_all: false, updates_for: '',
  credits: '0', credits_validity_days: '',
}

// Date et heure de fin de promo affichées et saisies à l'heure locale de la plateforme (site.timezone).
const TZ = TZ_ISO
function toForm(p: Product): Form {
  let promo_date = ''
  let promo_time = '00:00'
  if (p.promo_ends_at) {
    const local = new Date(new Date(p.promo_ends_at).getTime() + TZ_OFFSET_MS).toISOString()
    promo_date = local.slice(0, 10)
    promo_time = local.slice(11, 16)
  }
  const s = (v: unknown) => (v == null ? '' : String(v))
  return {
    slug: p.slug, category: p.category, title: p.title, subtitle: s(p.subtitle), description: s(p.description), features: p.features.join('\n'),
    price_fcfa: s(p.price_fcfa), compare_at_fcfa: s(p.compare_at_fcfa), promo_price_fcfa: s(p.promo_price_fcfa), promo_date, promo_time,
    image: s(p.image), sales_url: s(p.sales_url), external_url: s(p.external_url), request_kind: s(p.request_kind), includes: p.includes.join(', '),
    published: p.published, preorder: !!p.preorder, position: String(p.position),
    billing: p.billing ?? 'one_time', period_days: String(p.period_days ?? 30), covers_all: !!p.covers_all, updates_for: s(p.updates_for),
    credits: String(p.credits ?? 0), credits_validity_days: s(p.credits_validity_days),
  }
}

export default function AdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'new'
  const router = useRouter()
  const confirm = useConfirm()
  const [form, setForm] = useState<Form>(empty)
  const [lessons, setLessons] = useState<AdminLesson[]>([])
  const [files, setFiles] = useState<AdminFile[]>([])
  const [privateInfo, setPrivateInfo] = useState({ group_url: '', welcome_message: '' })
  const [buyers, setBuyers] = useState(0)
  const [message, setMessage] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(isNew)
  const [catalog, setCatalog] = useState<Product[]>([])
  // Catalogue complet : pour composer un pack (produits inclus) en cochant.
  useEffect(() => { api<{ products: Product[] }>('/api/admin/products').then((d) => d.success && setCatalog(d.products)) }, [])

  const load = useCallback(async () => {
    if (isNew) return
    const d = await api<{ product: Product; lessons: AdminLesson[]; files: AdminFile[]; privateInfo: { group_url: string | null; welcome_message: string | null }; buyers: number }>(`/api/admin/products/${id}`)
    if (!d.success) return setMessage({ tone: 'red', text: d.message || 'Produit introuvable.' })
    setForm(toForm(d.product))
    setLessons(d.lessons)
    setFiles(d.files)
    setPrivateInfo({ group_url: d.privateInfo.group_url ?? '', welcome_message: d.privateInfo.welcome_message ?? '' })
    setBuyers(d.buyers)
    setLoaded(true)
  }, [id, isNew])
  useEffect(() => { load() }, [load])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  const save = async () => {
    setSaving(true)
    setMessage(null)
    if (form.promo_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.promo_time)) {
      setSaving(false)
      return setMessage({ tone: 'red', text: 'Heure de fin de promo : format HH:MM (ex. 23:59).' })
    }
    const body = {
      ...form,
      features: form.features.split('\n').map((f) => f.trim()).filter(Boolean),
      includes: form.includes.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean),
      promo_ends_at: form.promo_date ? `${form.promo_date}T${form.promo_time || '00:00'}:00${TZ}` : null,
      request_kind: form.request_kind || null,
      position: Number(form.position) || 0,
      period_days: Number(form.period_days) || 30,
      updates_for: form.billing === 'monthly' && !form.covers_all ? form.updates_for || null : null,
      covers_all: form.billing === 'monthly' && form.covers_all,
      credits: form.category === 'credits' ? Number(form.credits) || 0 : 0,
      credits_validity_days: form.category === 'credits' && form.credits_validity_days ? Number(form.credits_validity_days) : null,
    }
    const d = await api<{ id?: string }>(isNew ? '/api/admin/products' : `/api/admin/products/${id}`, isNew ? 'POST' : 'PATCH', body)
    setSaving(false)
    if (!d.success) return setMessage({ tone: 'red', text: d.message || 'Enregistrement impossible.' })
    if (isNew && d.id) return router.replace(`/admin/products/${d.id}`)
    setMessage({ tone: 'green', text: 'Enregistré. La boutique est à jour.' })
  }

  const savePrivate = async () => {
    const d = await api(`/api/admin/products/${id}/private`, 'PUT', privateInfo)
    setMessage(d.success ? { tone: 'green', text: 'Infos acheteurs enregistrées.' } : { tone: 'red', text: d.message || 'Erreur.' })
  }

  const remove = async () => {
    if (!(await confirm({ title: 'Supprimer ce produit ?', message: 'Ses leçons et fichiers seront supprimés. Impossible si le produit a déjà des acheteurs.', confirmLabel: 'Supprimer', danger: true }))) return
    const d = await api(`/api/admin/products/${id}`, 'DELETE')
    if (d.success) router.replace('/admin/products')
    else setMessage({ tone: 'red', text: d.message || 'Suppression impossible.' })
  }

  if (!loaded) return <main className="p-8 text-sm text-gray-500">{message?.text ?? 'Chargement…'}</main>

  return (
    <main className="max-w-5xl space-y-8 p-4 md:p-8">
      <div>
        <Link href="/admin/products" className="text-sm text-gray-500 hover:text-gray-900">← Produits</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">{isNew ? 'Nouveau produit' : form.title}</h1>
          {!isNew && <span className="text-sm text-gray-500">{buyers} acheteur{buyers > 1 ? 's' : ''}</span>}
          {!isNew && form.published && (
            <a href={form.sales_url || `/boutique/${form.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-brand underline">Voir la page ↗</a>
          )}
        </div>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-surface p-5">
        <h2 className="text-xl">Fiche produit</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Titre"><input className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Identifiant (adresse)" hint="Minuscules et tirets, ex. ma-formation. Ne le change pas après la vente : les liens en dépendent.">
            <input className={inputClass} value={form.slug} onChange={(e) => set('slug', e.target.value)} />
          </Field>
          <Field label="Rayon">
            <Select value={form.category} onChange={(v) => set('category', v)} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
          </Field>
          <Field label="Ordre d'affichage" hint="Plus petit = plus haut dans le rayon."><input className={inputClass} inputMode="numeric" value={form.position} onChange={(e) => set('position', e.target.value)} /></Field>
          <Field label="Sous-titre (une phrase)" className="md:col-span-2"><input className={inputClass} value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} /></Field>
          <Field label="Description" className="md:col-span-2"><textarea className={inputClass} rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Points forts (un par ligne)" className="md:col-span-2"><textarea className={inputClass} rows={4} value={form.features} onChange={(e) => set('features', e.target.value)} /></Field>
          <Field label="Image" hint="Chemin d'une image du site (ex. /produits/ma-formation.png) ou adresse https://"><input className={inputClass} value={form.image} onChange={(e) => set('image', e.target.value)} /></Field>
          <Field label="Page de vente dédiée (facultatif)" hint="Ex. /formations/ma-formation. Vide = fiche produit automatique."><input className={inputClass} value={form.sales_url} onChange={(e) => set('sales_url', e.target.value)} /></Field>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-surface p-5">
        <h2 className="text-xl">Prix et vente</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Prix (FCFA)" hint="Vide = sur demande / sur devis (formulaire de demande)."><input className={inputClass} inputMode="numeric" value={form.price_fcfa} onChange={(e) => set('price_fcfa', e.target.value)} /></Field>
          <Field label="Prix barré (FCFA, facultatif)"><input className={inputClass} inputMode="numeric" value={form.compare_at_fcfa} onChange={(e) => set('compare_at_fcfa', e.target.value)} /></Field>
          <Field label="Prix promo (FCFA, facultatif)"><input className={inputClass} inputMode="numeric" value={form.promo_price_fcfa} onChange={(e) => set('promo_price_fcfa', e.target.value)} /></Field>
          <Field label="Fin de la promo (date)"><DatePicker value={form.promo_date} onChange={(v) => set('promo_date', v)} placeholder="Sans fin" /></Field>
          <Field label="Heure de fin (heure locale)" hint="HH:MM, ex. 00:00"><input className={inputClass} value={form.promo_time} onChange={(e) => set('promo_time', e.target.value)} /></Field>
          <div className="flex items-end pb-2">{form.promo_date && <button type="button" className="text-sm text-gray-500 underline" onClick={() => set('promo_date', '')}>Retirer la date de fin</button>}</div>
          <Field label="Logiciel vendu ailleurs (lien externe)" hint="Ex. https://monlogiciel.com : le bouton ouvre ce site." className="md:col-span-2"><input className={inputClass} value={form.external_url} onChange={(e) => set('external_url', e.target.value)} /></Field>
          <Field label="Formulaire de demande">
            <Select value={form.request_kind} onChange={(v) => set('request_kind', v)} options={[{ value: '', label: 'Aucun' }, ...Object.entries(REQUEST_KINDS).map(([value, label]) => ({ value, label }))]} />
          </Field>
          {form.category === 'credits' && (
            <>
              <Field label="Crédits versés" hint="Ajoutés au solde du client dès le paiement confirmé."><input className={inputClass} inputMode="numeric" value={form.credits} onChange={(e) => set('credits', e.target.value)} /></Field>
              <Field label="Validité (jours)" hint="Vide = les crédits n’expirent jamais."><input className={inputClass} inputMode="numeric" value={form.credits_validity_days} onChange={(e) => set('credits_validity_days', e.target.value)} /></Field>
            </>
          )}
          <Field label="Type de vente">
            <Select value={form.billing} onChange={(v) => set('billing', v)} options={[{ value: 'one_time', label: 'Achat unique (à vie)' }, { value: 'monthly', label: 'Abonnement (renouvelable)' }]} />
          </Field>
          {form.billing === 'monthly' && (
            <>
              <Field label="Durée d'une période (jours)" hint="30 = mensuel. Chaque paiement ajoute cette durée."><input className={inputClass} inputMode="numeric" value={form.period_days} onChange={(e) => set('period_days', e.target.value)} /></Field>
              <div className="flex items-end pb-2"><Switch checked={form.covers_all} onChange={(v) => set('covers_all', v)} label={form.covers_all ? 'Super abonnement : tous les cours' : 'Abonnement d’un seul cours'} /></div>
              {!form.covers_all && (
                <Field label="Cours mis à jour" hint="Identifiant du cours (ex. ma-formation). Réservé à ses acheteurs ; débloque les leçons sorties après leur achat.">
                  <input className={inputClass} value={form.updates_for} onChange={(e) => set('updates_for', e.target.value)} />
                </Field>
              )}
            </>
          )}
          <div className="space-y-2 md:col-span-2">
            <p className="text-sm text-gray-600">Contenu du pack : produits donnés avec celui-ci</p>
            <p className="text-xs text-gray-500">Coche les formations, kits ou abonnements inclus (ex. un pack YouTube + Facebook, « Toutes les formations », ou le 1er mois d’abonnement offert avec un cours). L’acheteur reçoit l’accès à chacun.</p>
            {(() => {
              const chosen = form.includes.split(/[,\s]+/).filter(Boolean)
              const toggle = (slug: string, on: boolean) => set('includes', (on ? [...chosen, slug] : chosen.filter((x) => x !== slug)).join(', '))
              const options = catalog.filter((p) => p.slug !== form.slug)
              const sum = options.filter((p) => chosen.includes(p.slug)).reduce((t, p) => t + (p.price_fcfa ?? 0), 0)
              return (
                <>
                  <div className="grid gap-x-6 gap-y-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
                    {options.length === 0 && <span className="text-sm text-gray-500">Chargement du catalogue…</span>}
                    {options.map((p) => (
                      <Checkbox key={p.id} checked={chosen.includes(p.slug)} onChange={(v) => toggle(p.slug, v)}
                        label={<span>{p.title} <span className="text-xs text-gray-500">· {CATEGORIES.find((c) => c.id === p.category)?.label ?? p.category}{p.price_fcfa ? ` · ${formatFcfa(p.price_fcfa)}` : ''}</span></span>} />
                    ))}
                  </div>
                  {sum > 0 && <p className="text-xs text-gray-500">Valeur des produits inclus : {formatFcfa(sum)}{form.price_fcfa ? ` · prix du pack : ${formatFcfa(Number(form.price_fcfa))}` : ''}</p>}
                </>
              )
            })()}
          </div>
          <div className="flex items-end pb-2"><Switch checked={form.published} onChange={(v) => set('published', v)} label={form.published ? 'Visible dans la boutique' : 'Masqué'} /></div>
          <div className="flex items-end pb-2"><Switch checked={form.preorder} onChange={(v) => set('preorder', v)} label={form.preorder ? 'Précommande (réservation 10 %, puis 60 %)' : 'Disponible'} /></div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={save} disabled={saving} className="rounded-full px-6">{saving ? 'Enregistrement…' : isNew ? 'Créer le produit' : 'Enregistrer'}</Button>
          {!isNew && <Button variant="ghost" onClick={remove} className="rounded-full text-red-700">Supprimer</Button>}
        </div>
      </section>

      {!isNew && (
        <>
          <LessonsEditor productId={id} lessons={lessons} onChange={load} />
          {form.category === 'formation' && <AnnouncePanel productId={id} />}
          <FilesEditor productId={id} files={files} onChange={load} />
          <section className="space-y-4 rounded-2xl border border-gray-200 bg-surface p-5">
            <h2 className="text-xl">Réservé aux acheteurs</h2>
            <Field label="Lien du groupe WhatsApp" hint="Visible uniquement dans l'espace des acheteurs de ce produit.">
              <input className={inputClass} value={privateInfo.group_url} onChange={(e) => setPrivateInfo({ ...privateInfo, group_url: e.target.value })} placeholder="https://chat.whatsapp.com/…" />
            </Field>
            <Field label="Message d'accueil">
              <textarea className={inputClass} rows={4} value={privateInfo.welcome_message} onChange={(e) => setPrivateInfo({ ...privateInfo, welcome_message: e.target.value })} />
            </Field>
            <Button onClick={savePrivate} className="rounded-full px-6">Enregistrer</Button>
          </section>
        </>
      )}
    </main>
  )
}
