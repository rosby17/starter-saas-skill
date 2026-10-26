'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/choice'
import { DatePicker } from '@/components/ui/date-picker'
import { Select } from '@/components/ui/select'
import { useConfirm } from '@/components/ui/dialog'
import { Field, Notice, api, inputClass } from '@/components/admin/kit'
import { hasModule } from '@/config/site'
import { TZ_ISO, TZ_LABEL, TZ_OFFSET_MS, localDay } from '@/lib/time'
import { ALL_SERVICES, type FreeWindow, type NudgeConfig, type WelcomeConfig } from '@/lib/credits/settings'

// Administration › Crédits : crédits de bienvenue, proposition de recharge au solde faible (et son suivi),
// fenêtre de gratuité d'un service. Chaque bloc s'ouvre PRÉ-REMPLI avec la valeur en place.
type Stats = { shown: number; dismissed: number; clicked: number; paid: number }
type Data = { settings: { recharge_nudge: NudgeConfig; welcome_credits: WelcomeConfig; free_window: FreeWindow }; services: string[]; stats: Stats | null }

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h).padStart(2, '0'), label: `${String(h).padStart(2, '0')} h 00` }))
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '—')
const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(/\s/g, '')))

export default function AdminCreditsPage() {
  const confirm = useConfirm()
  const [data, setData] = useState<Data | null>(null)
  const [message, setMessage] = useState<{ tone: 'green' | 'red'; text: string } | null>(null)
  const [welcome, setWelcome] = useState({ amount: '', days: '' })
  const [nudge, setNudge] = useState({ threshold: '', snooze: '' })
  const [free, setFree] = useState<{ services: string[]; day: string; hour: string; label: string }>({ services: [], day: '', hour: '20', label: '' })

  const load = useCallback(async () => {
    const d = await api<Data>('/api/admin/credits/settings')
    if (!d.success) { setMessage({ tone: 'red', text: d.message || 'Lecture des réglages impossible.' }); return }
    setData(d)
    const { welcome_credits: w, recharge_nudge: n, free_window: f } = d.settings
    setWelcome({ amount: String(w.amount), days: w.validityDays ? String(w.validityDays) : '' })
    setNudge({ threshold: String(n.threshold), snooze: String(n.snoozeDays) })
    const active = f.until && Date.parse(f.until) > Date.now()
    setFree({
      services: f.services,
      day: active ? localDay(f.until!) : '',
      hour: active ? String(new Date(Date.parse(f.until!) + TZ_OFFSET_MS).getUTCHours()).padStart(2, '0') : '20',
      label: f.label,
    })
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (key: string, value: Record<string, unknown>) => {
    const d = await api('/api/admin/credits/settings', 'PUT', { key, value })
    setMessage({ tone: d.success ? 'green' : 'red', text: d.message || (d.success ? 'Enregistré.' : 'Erreur.') })
    if (d.success) load()
  }

  if (!hasModule('credits')) return <main className="p-4 md:p-8"><Notice>Le module « crédits » est coupé (site.modules dans src/config/site.ts).</Notice></main>
  if (!data) return <main className="p-4 text-sm text-gray-500 md:p-8">{message?.text ?? 'Chargement…'}</main>

  const fw = data.settings.free_window
  const freeActive = !!fw.until && Date.parse(fw.until) > Date.now()
  const services = [...new Set([...data.services, ...fw.services.filter((s) => s !== ALL_SERVICES)])]
  const toggleService = (s: string, on: boolean) => setFree((f) => ({ ...f, services: on ? [...f.services.filter((x) => x !== ALL_SERVICES), s] : f.services.filter((x) => x !== s) }))
  const startFree = async () => {
    if (!free.day || !free.services.length) { setMessage({ tone: 'red', text: 'Choisis les services et la date de fin.' }); return }
    const until = new Date(`${free.day}T${free.hour}:00:00${TZ_ISO}`)
    if (until.getTime() <= Date.now()) { setMessage({ tone: 'red', text: 'La date de fin est déjà passée.' }); return }
    const what = free.services.includes(ALL_SERVICES) ? 'TOUS les services payants' : free.services.join(', ')
    if (!(await confirm({ title: 'Ouvrir la gratuité ?', message: `${what} ne coûteront aucun crédit jusqu’au ${until.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })} (${TZ_LABEL}). La facturation normale revient seule à cette heure.`, confirmLabel: 'Ouvrir' }))) return
    save('free_window', { services: free.services, until: until.toISOString(), label: free.label })
  }
  const stopFree = async () => {
    if (!(await confirm({ title: 'Arrêter la gratuité maintenant ?', message: 'La facturation normale reprend tout de suite (au plus 15 secondes).', confirmLabel: 'Arrêter', danger: true }))) return
    save('free_window', { services: [], until: null, label: '' })
  }
  const s = data.stats

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <div>
        <h1 className="text-3xl">Crédits</h1>
        <p className="text-sm text-gray-500">Crédits offerts à l’inscription, proposition de recharge quand le solde baisse, gratuité temporaire d’un service. Pour ajouter des crédits à un client : sa fiche, dans Clients.</p>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-surface p-5">
        <div><h2 className="text-xl">Crédits de bienvenue</h2><p className="text-sm text-gray-500">Versés une seule fois à chaque nouveau compte (jamais aux adresses jetables). 0 = coupé.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Crédits offerts"><input className={inputClass} inputMode="numeric" value={welcome.amount} onChange={(e) => setWelcome({ ...welcome, amount: e.target.value })} /></Field>
          <Field label="Valables (jours)" hint="Vide = sans date d’expiration : ils restent jusqu’à ce que le client les utilise."><input className={inputClass} inputMode="numeric" placeholder="Sans date d’expiration" value={welcome.days} onChange={(e) => setWelcome({ ...welcome, days: e.target.value })} /></Field>
        </div>
        <Button onClick={() => save('welcome_credits', { amount: num(welcome.amount) || 0, validityDays: welcome.days ? num(welcome.days) : null })}>Enregistrer</Button>
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-surface p-5">
        <div><h2 className="text-xl">Solde faible : proposition de recharge</h2><p className="text-sm text-gray-500">Sous ce seuil, le client voit une petite carte avec le pack qu’il achète d’habitude (sinon celui qui couvre son mois de consommation). « Plus tard » la fait taire quelques jours.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Seuil (crédits)"><input className={inputClass} inputMode="numeric" value={nudge.threshold} onChange={(e) => setNudge({ ...nudge, threshold: e.target.value })} /></Field>
          <Field label="Pause après « Plus tard » (jours)"><input className={inputClass} inputMode="numeric" value={nudge.snooze} onChange={(e) => setNudge({ ...nudge, snooze: e.target.value })} /></Field>
        </div>
        <Button onClick={() => save('recharge_nudge', { threshold: num(nudge.threshold), snoozeDays: num(nudge.snooze) })}>Enregistrer</Button>
        {s && (
          <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-4 sm:grid-cols-4">
            {[['Affichée', fmt(s.shown), ''], ['« Plus tard »', fmt(s.dismissed), pct(s.dismissed, s.shown)], ['Cliquée', fmt(s.clicked), pct(s.clicked, s.shown)], ['Payée (72 h)', fmt(s.paid), pct(s.paid, s.clicked)]].map(([label, value, rate]) => (
              <div key={label} className="rounded-xl border border-gray-200 p-3">
                <p className="text-xs text-gray-500">{label} · 30 jours</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
                {rate && <p className="text-xs text-gray-500">{rate}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-surface p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1"><h2 className="text-xl">Gratuité temporaire</h2><p className="text-sm text-gray-500">« Illimité » le temps d’un lancement ou d’un essai : ces services ne débitent aucun crédit jusqu’à l’heure de fin, puis la facturation revient seule.</p></div>
          {freeActive ? <Badge tone="green">En cours jusqu’au {new Date(fw.until!).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</Badge> : <Badge>Aucune</Badge>}
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Services concernés</p>
          <div className="grid gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
            <Checkbox checked={free.services.includes(ALL_SERVICES)} onChange={(v) => setFree((f) => ({ ...f, services: v ? [ALL_SERVICES] : [] }))} label="Tous les services payants" />
            {services.map((sv) => <Checkbox key={sv} checked={free.services.includes(sv)} onChange={(v) => toggleService(sv, v)} label={sv} />)}
          </div>
          {!services.length && <p className="text-xs text-gray-500">Aucun service facturé ces 90 derniers jours : chaque service apparaît ici dès son premier débit (la « raison » passée à debitCredits()).</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Jusqu’au"><DatePicker value={free.day} onChange={(day) => setFree({ ...free, day })} min={localDay(Date.now())} /></Field>
          <Field label={`Heure de fin (${TZ_LABEL})`}><Select value={free.hour} onChange={(hour) => setFree({ ...free, hour })} options={HOURS} /></Field>
          <Field label="Nom de l’opération" hint="Pour toi seulement."><input className={inputClass} placeholder="Lancement du nouveau modèle" value={free.label} onChange={(e) => setFree({ ...free, label: e.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={startFree}>{freeActive ? 'Mettre à jour' : 'Ouvrir la gratuité'}</Button>
          {freeActive && <Button variant="secondary" onClick={stopFree}>Arrêter maintenant</Button>}
        </div>
      </section>
    </main>
  )
}
