'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/choice'
import { useConfirm } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { copyText } from '@/lib/clipboard'
import { fillCoachMessage, whatsappMessageLink } from '@/lib/coach/message'
import { clsx } from '@/lib/utils'
import type { ClientReply, CoachContact, CoachState, DailyAction, DailyBrief } from './types'

// Coach business : la journée se lit comme une CHECKLIST. Un anneau de progression avance à chaque tâche
// cochée, une seule tâche est ouverte à la fois (la suivante s'ouvre quand on coche), le détail n'apparaît
// qu'à l'ouverture. Les clients se relancent par e-mail groupé ; WhatsApp reste manuel (lien pré-rempli).

const POLL_MS = 10_000
const fcfa = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} FCFA`
const KIND_LABELS: Record<DailyAction['kind'], string> = { contacter: 'Contacter', developper: 'Développer', configurer: 'Configurer', acheter: 'Acheter', surveiller: 'Surveiller' }
const IMPACT_TONE = { fort: 'green', moyen: 'amber', faible: 'gray' } as const
const VERDICT = { bon: { label: 'Bonne journée', tone: 'green' }, moyen: { label: 'À surveiller', tone: 'amber' }, critique: { label: 'Critique', tone: 'red' } } as const

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = await res.json().catch(() => ({ success: false, message: 'Réponse illisible.' }))
  if (!json.success) throw new Error(json.message || 'Action impossible.')
  return json
}

function useCoachDaily() {
  const [state, setState] = useState<CoachState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const json = await send('/api/admin/coach/daily', 'GET')
      setState(json as CoachState)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lecture impossible.')
    }
  }, [])
  useEffect(() => { void load() }, [load])
  // L'analyse tourne en arrière-plan (une à plusieurs minutes) : on revient la chercher.
  useEffect(() => {
    if (!state?.generating) return
    const timer = setInterval(() => { void load() }, POLL_MS)
    return () => clearInterval(timer)
  }, [state?.generating, load])
  return { state, setState, error, setError, load }
}

export function CoachBoard() {
  const { state, setState, error, setError, load } = useCoachDaily()
  const confirm = useConfirm()
  const [open, setOpen] = useState<number | null>(null)
  const [touched, setTouched] = useState(false)

  const daily = state?.daily ?? null
  const brief = daily?.brief ?? null
  const done = daily?.done ?? {}
  const total = brief?.actions.length ?? 0
  const doneCount = brief ? brief.actions.filter((_, i) => done[String(i)]).length : 0
  // Tant que l'admin n'a rien ouvert lui-même, la première tâche à faire est ouverte.
  const firstTodo = brief ? brief.actions.findIndex((_, i) => !done[String(i)]) : -1
  const current = touched ? open : firstTodo >= 0 ? firstTodo : null

  const patchDaily = (patch: Partial<NonNullable<CoachState['daily']>>) => setState((s) => (s?.daily ? { ...s, daily: { ...s.daily, ...patch } } : s))

  const toggleDone = async (index: number, value: boolean) => {
    try {
      const json = await send('/api/admin/coach/daily', 'PATCH', { action: index, done: value })
      patchDaily({ done: json.done })
      if (value && brief) {
        // Tâche cochée : la suivante s'ouvre, comme une étape.
        const next = brief.actions.findIndex((_, i) => i > index && !json.done[String(i)])
        setTouched(true)
        setOpen(next >= 0 ? next : null)
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Action impossible.') }
  }

  const redo = async () => {
    const ok = await confirm({ title: "Refaire l'analyse du jour ?", message: "Une nouvelle analyse est payante (appel au modèle Claude) et prend une à plusieurs minutes. Les cases cochées aujourd'hui seront remises à zéro.", confirmLabel: 'Refaire' })
    if (!ok) return
    try {
      await send('/api/admin/coach/daily', 'POST')
      setState((s) => (s ? { ...s, generating: true, failure: null } : s))
    } catch (e) { setError(e instanceof Error ? e.message : 'Action impossible.') }
  }

  if (!state && !error) return <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {state && !state.configured && (
        <EmptyState title="Coach éteint" text="Ajoutez la clé API Anthropic (ou la clé kie.ai de secours) dans Clés et intégrations : le premier point du jour se prépare tout seul à l'ouverture suivante."
          action={<Link href="/admin/keys?focus=ANTHROPIC_API_KEY#ANTHROPIC_API_KEY" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">Renseigner la clé</Link>} />
      )}
      {state?.generating && (
        <Card className="flex items-center gap-3 p-4 text-sm">
          <span className="h-3 w-3 animate-pulse rounded-full bg-brand" aria-hidden />
          <span>{daily ? "Nouvelle analyse en cours : l'ancienne reste affichée en attendant." : 'Le coach prépare le point du jour (une à plusieurs minutes)…'}</span>
        </Card>
      )}
      {state?.failure && !state.generating && (
        <p role="alert" className="break-words rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Le point du jour n&apos;a pas pu être préparé : {state.failure}. Nouvel essai automatique dans 30 min, ou bouton « Refaire l&apos;analyse ».
        </p>
      )}

      {daily && brief && (
        <>
          <Hero daily={daily} doneCount={doneCount} total={total} onRedo={redo} disabled={state?.generating ?? false} />

          <section aria-labelledby="coach-checklist" className="space-y-3">
            <h2 id="coach-checklist" className="text-lg font-bold">Checklist du jour</h2>
            {brief.actions.map((action, index) => (
              <TaskRow key={index} index={index} action={action} done={Boolean(done[String(index)])} open={current === index}
                onToggleOpen={() => { setTouched(true); setOpen(current === index ? null : index) }}
                onDone={(v) => toggleDone(index, v)}>
                <TaskDetail action={action} />
                {action.kind === 'contacter' && (
                  <ContactPanel actionIndex={index} action={action} contacts={state?.contacts[String(index)] ?? []} offerLink={state?.offerLink ?? ''}
                    onChanged={load} onError={setError} />
                )}
              </TaskRow>
            ))}
          </section>

          {(brief.watch.length > 0 || brief.followUp) && (
            <Card className="space-y-3 p-5">
              {brief.followUp && <div><h2 className="font-semibold">Suivi d&apos;hier</h2><p className="mt-1 text-sm text-gray-600">{brief.followUp}</p></div>}
              {brief.watch.length > 0 && <div><h2 className="font-semibold">À surveiller</h2><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-600">{brief.watch.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
            </Card>
          )}
          {brief.objectives && brief.objectives.length > 0 && <Objectives objectives={brief.objectives} />}
          {brief.ideas && brief.ideas.length > 0 && <Ideas ideas={brief.ideas} />}
          {brief.idealCustomer && <IdealCustomer study={brief.idealCustomer} />}
          <RepliesSection contacts={state?.contacts.replied ?? []} onChanged={load} onError={setError} />
          <IgnoredList contacts={state?.contacts.ignored ?? []} onChanged={load} onError={setError} />
        </>
      )}
    </div>
  )
}

/* ───────── En-tête : anneau de progression + l'essentiel ───────── */

function Hero({ daily, doneCount, total, onRedo, disabled }: { daily: NonNullable<CoachState['daily']>; doneCount: number; total: number; onRedo: () => void; disabled: boolean }) {
  const { brief, revenue } = daily
  const verdict = VERDICT[brief.verdict]
  const trend = revenue.previous30d ? Math.round(((revenue.last30d - revenue.previous30d) / revenue.previous30d) * 100) : null
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ProgressRing done={doneCount} total={total} />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={verdict.tone}>{verdict.label}</Badge><span className="text-xs text-gray-500">{new Date(daily.generatedAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}{daily.engine ? ` · ${daily.engine}` : ''}</span></div>
          <p className="text-lg font-semibold sm:text-xl">{brief.headline}</p>
          <ul className="space-y-1 text-sm text-gray-600">{brief.essentials.map((e, i) => <li key={i}>{e}</li>)}</ul>
          <p className="text-sm font-medium">{doneCount === total ? 'Tout est fait pour aujourd’hui. Bravo.' : doneCount === 0 ? `${total} tâches, la plus rentable d’abord.` : `Encore ${total - doneCount} tâche${total - doneCount > 1 ? 's' : ''}.`}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="30 derniers jours" value={fcfa(revenue.last30d)} hint={trend === null ? undefined : `${trend >= 0 ? '+' : ''}${trend} % vs 30 j précédents`} />
        <Stat label="Objectif du mois" value={`${revenue.goalProgress} %`} hint={`de ${fcfa(revenue.goal)}`} />
        <Stat label="7 derniers jours" value={fcfa(revenue.last7d)} />
        <Stat label="Panier moyen" value={fcfa(revenue.averageOrder)} hint={`${revenue.orders30d} vente${revenue.orders30d > 1 ? 's' : ''}, ${revenue.payingCustomers30d} client${revenue.payingCustomers30d > 1 ? 's' : ''}`} />
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={Math.min(100, revenue.goalProgress)} aria-valuemin={0} aria-valuemax={100} aria-label="Progression vers l'objectif du mois">
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, revenue.goalProgress)}%` }} />
      </div>
      <div className="mt-4 flex justify-end"><Button type="button" variant="ghost" onClick={onRedo} disabled={disabled}>Refaire l&apos;analyse</Button></div>
    </Card>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 break-words font-bold">{value}</p>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  const ratio = total ? done / total : 0
  return (
    <div className="relative mx-auto h-24 w-24 shrink-0 sm:mx-0" role="img" aria-label={`${done} tâche${done > 1 ? 's' : ''} faite${done > 1 ? 's' : ''} sur ${total}`}>
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" style={{ stroke: 'var(--black-line)' }} />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} style={{ stroke: 'var(--brand)', transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-lg font-bold">{done}/{total}</span>
    </div>
  )
}

/* ───────── Une tâche de la checklist ───────── */

function TaskRow({ index, action, done, open, onToggleOpen, onDone, children }: { index: number; action: DailyAction; done: boolean; open: boolean; onToggleOpen: () => void; onDone: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <Card className={clsx('p-0 transition-colors', open && 'border-gray-300', done && 'opacity-70')}>
      <div className="flex items-start gap-3 p-4">
        <div className="pt-0.5"><Checkbox checked={done} onChange={onDone} label={<span className="sr-only">Marquer « {action.title} » comme fait</span>} /></div>
        <button type="button" onClick={onToggleOpen} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">{index + 1}.</span>
            <Badge tone={IMPACT_TONE[action.impact]}>Impact {action.impact}</Badge>
            <span className="text-xs uppercase tracking-wide text-gray-500">{KIND_LABELS[action.kind]}</span>
          </span>
          <span className={clsx('mt-1 block font-semibold', done && 'line-through')}>{action.title}</span>
          {!open && action.why && <span className="mt-0.5 line-clamp-1 block text-sm text-gray-500">{action.why}</span>}
        </button>
      </div>
      {open && <div className="space-y-4 border-t border-gray-200 p-4">{children}</div>}
    </Card>
  )
}

function TaskDetail({ action }: { action: DailyAction }) {
  return (
    <div className="space-y-3 text-sm">
      {action.why && <p className="text-gray-600">{action.why}</p>}
      {action.steps && action.steps.length > 0 && <ol className="list-decimal space-y-1 pl-5">{action.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
      {action.prompt && <PromptBlock prompt={action.prompt} label="Prompt à donner au développeur" />}
    </div>
  )
}

function PromptBlock({ prompt, label }: { prompt: string; label: string }) {
  const [copied, setCopied] = useState<'ok' | 'ko' | null>(null)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <button type="button" onClick={async () => setCopied((await copyText(prompt)) ? 'ok' : 'ko')} className="text-xs font-medium underline">
          {copied === 'ok' ? 'Copié' : copied === 'ko' ? 'Sélectionnez et copiez à la main' : 'Copier'}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs">{prompt}</pre>
    </div>
  )
}

/* ───────── Clients à contacter ───────── */

function ContactPanel({ actionIndex, action, contacts, offerLink, onChanged, onError }: {
  actionIndex: number; action: DailyAction; contacts: CoachContact[]; offerLink: string; onChanged: () => void; onError: (m: string) => void
}) {
  const confirm = useConfirm()
  const [subject, setSubject] = useState(action.message?.subject ?? '')
  const [body, setBody] = useState(action.message?.body ?? '')
  const [lang, setLang] = useState<'fr' | 'en'>('fr')
  const emailable = contacts.filter((c) => c.email && !c.emailedAt)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(emailable.map((c) => c.userId)))
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  if (!contacts.length) return <p className="text-sm text-gray-500">Aucun client dans ce groupe aujourd’hui (ou tous écartés).</p>

  const sendAll = async () => {
    const ids = emailable.filter((c) => selected.has(c.userId)).map((c) => c.userId)
    if (!ids.length) return
    const ok = await confirm({ title: `Envoyer l'e-mail à ${ids.length} client${ids.length > 1 ? 's' : ''} ?`, message: `Objet : « ${subject} ». Chaque client reçoit le message à son prénom, avec la signature réglée dans le coach.`, confirmLabel: 'Envoyer' })
    if (!ok) return
    setSending(true)
    setResult(null)
    try {
      const json = await send('/api/admin/coach/daily/email', 'POST', { action: actionIndex, userIds: ids, subject, body, lang })
      setResult(`${json.sent} e-mail${json.sent > 1 ? 's' : ''} envoyé${json.sent > 1 ? 's' : ''}${json.failed ? `, ${json.failed} en échec (voir Administration › E-mails)` : ''}${json.skipped ? `, ${json.skipped} déjà relancé${json.skipped > 1 ? 's' : ''} ou sans e-mail` : ''}.`)
      onChanged()
    } catch (e) { onError(e instanceof Error ? e.message : 'Envoi impossible.') } finally { setSending(false) }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-500" htmlFor={`subject-${actionIndex}`}>Objet</label>
        <input id={`subject-${actionIndex}`} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-gray-400" />
        <label className="block text-xs font-medium text-gray-500" htmlFor={`body-${actionIndex}`}>Message ({'{prenom}'} et {'{lien}'} sont remplacés pour chaque client)</label>
        <textarea id={`body-${actionIndex}`} value={body} onChange={(e) => setBody(e.target.value)} rows={7} maxLength={4000} className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-gray-400" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Checkbox checked={emailable.length > 0 && emailable.every((c) => selected.has(c.userId))} onChange={(v) => setSelected(v ? new Set(emailable.map((c) => c.userId)) : new Set())} label="Tout sélectionner" />
        <div className="w-40"><Select value={lang} onChange={(v) => setLang(v as 'fr' | 'en')} options={[{ value: 'fr', label: 'Signature en français' }, { value: 'en', label: 'Signature en anglais' }]} /></div>
        <Button type="button" onClick={sendAll} disabled={sending || !subject.trim() || !body.trim() || !emailable.some((c) => selected.has(c.userId))}>
          {sending ? 'Envoi…' : `Envoyer l'e-mail (${emailable.filter((c) => selected.has(c.userId)).length})`}
        </Button>
      </div>
      {result && <p className="text-sm text-green-700">{result}</p>}

      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
        {contacts.map((c) => (
          <ContactRow key={c.userId} contact={c} selectable={Boolean(c.email && !c.emailedAt)} selected={selected.has(c.userId)}
            onSelect={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(c.userId); else n.delete(c.userId); return n })}
            text={fillCoachMessage(body, c.firstName, offerLink)} actionTitle={action.title} onChanged={onChanged} onError={onError} />
        ))}
      </ul>
    </div>
  )
}

function ContactRow({ contact, selectable, selected, onSelect, text, actionTitle, onChanged, onError }: {
  contact: CoachContact; selectable: boolean; selected: boolean; onSelect: (v: boolean) => void; text: string; actionTitle: string; onChanged: () => void; onError: (m: string) => void
}) {
  const [replying, setReplying] = useState(false)
  const wa = whatsappMessageLink(contact.phone, text)
  const mark = async (body: unknown) => { try { await send('/api/admin/coach/daily', 'PATCH', body); onChanged() } catch (e) { onError(e instanceof Error ? e.message : 'Action impossible.') } }
  return (
    <li className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {selectable ? <Checkbox checked={selected} onChange={onSelect} label={<span className="font-medium">{contact.name || contact.email || 'Client'}</span>} /> : <span className="font-medium">{contact.name || contact.email || 'Client'}</span>}
        <Link href={`/admin/customers/${contact.userId}`} className="text-xs text-gray-500 underline">Fiche</Link>
        {contact.emailedAt && <Badge tone="green">E-mail envoyé</Badge>}
        {contact.contactedAt && !contact.emailedAt && <Badge tone="green">Contacté</Badge>}
        {!contact.email && <span className="text-xs text-gray-500">sans e-mail</span>}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {wa && <a href={wa} target="_blank" rel="noreferrer" onClick={() => { if (!contact.contactedAt) void mark({ contacted: contact.userId, value: true }) }} className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">WhatsApp</a>}
          <button type="button" onClick={() => mark({ contacted: contact.userId, value: !contact.contactedAt })} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs">{contact.contactedAt ? 'Pas contacté' : 'Contacté'}</button>
          <button type="button" onClick={() => setReplying((v) => !v)} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs">Sa réponse</button>
          <button type="button" onClick={() => mark({ ignore: contact.userId, value: true })} className="rounded-lg px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100">Ignorer</button>
        </span>
      </div>
      {contact.lastReply && <ReplyCard contact={contact} reply={contact.lastReply} onChanged={onChanged} onError={onError} />}
      {replying && <ReplyBox contact={contact} actionTitle={actionTitle} onSaved={() => { setReplying(false); onChanged() }} onError={onError} />}
    </li>
  )
}

function ReplyBox({ contact, actionTitle, onSaved, onError }: { contact: CoachContact; actionTitle: string | null; onSaved: () => void; onError: (m: string) => void }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try { await send('/api/admin/coach/replies', 'POST', { userId: contact.userId, text, action: actionTitle }); onSaved() } catch (e) { onError(e instanceof Error ? e.message : 'Enregistrement impossible.') } finally { setSaving(false) }
  }
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={3000} aria-label={`Réponse de ${contact.name || 'ce client'}`}
        placeholder="Collez la réponse du client (ou résumez-la) : le coach l'analyse et propose la suite." className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm outline-none focus:border-gray-400" />
      <Button type="button" onClick={save} disabled={saving || text.trim().length < 2}>{saving ? 'Analyse…' : 'Enregistrer et analyser'}</Button>
    </div>
  )
}

function ReplyCard({ contact, reply, onChanged, onError }: { contact: CoachContact; reply: ClientReply; onChanged: () => void; onError: (m: string) => void }) {
  const confirm = useConfirm()
  const a = reply.analysis
  const wa = a?.message ? whatsappMessageLink(contact.phone, a.message.replaceAll('{prenom}', contact.firstName || '')) : null
  const remove = async () => {
    if (!(await confirm({ title: 'Retirer cette réponse ?', message: 'Elle ne servira plus au coach.', confirmLabel: 'Retirer', danger: true }))) return
    try { await send('/api/admin/coach/replies', 'DELETE', { userId: contact.userId, at: reply.at }); onChanged() } catch (e) { onError(e instanceof Error ? e.message : 'Suppression impossible.') }
  }
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
      <p className="break-words text-gray-700">« {reply.text} »</p>
      {a ? (
        <div className="space-y-1">
          <p><span className="font-medium">Motif :</span> {a.reason} <Badge tone={a.intent === 'forte' ? 'green' : a.intent === 'moyenne' ? 'amber' : 'gray'}>intention {a.intent}</Badge></p>
          <p><span className="font-medium">À faire :</span> {a.nextAction}</p>
          {a.recontactAfter && <p className="text-gray-600">Pas de relance avant le {new Date(a.recontactAfter).toLocaleDateString('fr-FR')}.</p>}
          {a.lesson && <p className="text-gray-600">Leçon : {a.lesson}</p>}
          {a.message && <PromptBlock prompt={a.message} label="Message proposé" />}
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">Envoyer sur WhatsApp</a>}
        </div>
      ) : <p className="text-gray-500">Pas encore analysée (moteur IA indisponible) : elle servira au prochain point du jour.</p>}
      <button type="button" onClick={remove} className="text-xs text-gray-500 underline">Retirer</button>
    </div>
  )
}

function RepliesSection({ contacts, onChanged, onError }: { contacts: CoachContact[]; onChanged: () => void; onError: (m: string) => void }) {
  if (!contacts.length) return null
  return (
    <Card className="space-y-3 p-5">
      <h2 className="font-semibold">Réponses des clients (30 jours)</h2>
      {contacts.map((c) => c.lastReply && (
        <div key={c.userId} className="space-y-1">
          <p className="text-sm font-medium">{c.name || c.email || 'Client'} · <span className="text-gray-500">{new Date(c.lastReply.at).toLocaleDateString('fr-FR')}</span></p>
          <ReplyCard contact={c} reply={c.lastReply} onChanged={onChanged} onError={onError} />
        </div>
      ))}
    </Card>
  )
}

function IgnoredList({ contacts, onChanged, onError }: { contacts: CoachContact[]; onChanged: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  if (!contacts.length) return null
  const restore = async (id: string) => { try { await send('/api/admin/coach/daily', 'PATCH', { ignore: id, value: false }); onChanged() } catch (e) { onError(e instanceof Error ? e.message : 'Action impossible.') } }
  return (
    <Card className="p-5">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="font-semibold">Clients ignorés ({contacts.length})</button>
      <p className="text-sm text-gray-500">Écartés à la main : ni dans les listes, ni dans les groupes comptés par le coach.</p>
      {open && (
        <ul className="mt-3 space-y-2">
          {contacts.map((c) => (
            <li key={c.userId} className="flex flex-wrap items-center gap-3 text-sm">
              <span>{c.name || c.email || 'Client'}</span>
              <button type="button" onClick={() => restore(c.userId)} className="text-xs underline">Réafficher</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ───────── Objectifs, idées, client idéal ───────── */

const AREA_LABELS = { marketing: 'Marketing', finance: 'Finance', produit: 'Produit', ventes: 'Ventes' } as const

function Objectives({ objectives }: { objectives: NonNullable<DailyBrief['objectives']> }) {
  return (
    <section aria-labelledby="coach-objectives" className="space-y-3">
      <h2 id="coach-objectives" className="text-lg font-bold">Objectifs</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {objectives.map((o, i) => (
          <Card key={i} className="p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">{AREA_LABELS[o.area]}</p>
            <p className="mt-1 font-semibold">{o.goal}</p>
            <p className="mt-1 text-sm text-gray-600">{o.method}</p>
          </Card>
        ))}
      </div>
    </section>
  )
}

function Ideas({ ideas }: { ideas: NonNullable<DailyBrief['ideas']> }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <section aria-labelledby="coach-ideas" className="space-y-3">
      <h2 id="coach-ideas" className="text-lg font-bold">Idées tirées du comportement des clients</h2>
      {ideas.map((idea, i) => (
        <Card key={i} className="p-4">
          <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="w-full text-left">
            <span className="flex flex-wrap items-center gap-2"><Badge tone={IMPACT_TONE[idea.impact]}>Impact {idea.impact}</Badge><span className="font-semibold">{idea.feature}</span></span>
            <span className="mt-1 block text-sm text-gray-600">{idea.observation}</span>
          </button>
          {open === i && (
            <div className="mt-3 space-y-3 text-sm">
              <p><span className="font-medium">Besoin :</span> {idea.need}</p>
              <PromptBlock prompt={idea.prompt} label="Prompt à donner au développeur" />
            </div>
          )}
        </Card>
      ))}
    </section>
  )
}

function IdealCustomer({ study }: { study: NonNullable<DailyBrief['idealCustomer']> }) {
  return (
    <Card className="space-y-4 p-5">
      <h2 className="text-lg font-bold">Client idéal</h2>
      <p className="text-sm text-gray-700">{study.portrait}</p>
      {study.whyTheyBuy.length > 0 && <div><h3 className="text-sm font-semibold">Pourquoi ils paient</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-600">{study.whyTheyBuy.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
      {study.channels.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {study.channels.map((c, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-3 text-sm">
              <p className="font-semibold">{c.platform}</p>
              <p className="text-gray-600">{c.angle}</p>
              {c.contentIdeas.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-5">{c.contentIdeas.map((idea, j) => <li key={j}>{idea}</li>)}</ul>}
              {(c.cadence || c.kpi) && <p className="mt-2 text-xs text-gray-500">{[c.cadence, c.kpi && `Indicateur : ${c.kpi}`].filter(Boolean).join(' · ')}</p>}
            </div>
          ))}
        </div>
      )}
      {study.trustBuilders.length > 0 && <div><h3 className="text-sm font-semibold">Ce qui les fait essayer</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-600">{study.trustBuilders.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
      <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm"><span className="font-semibold">Offre d&apos;essai :</span> {study.testOffer}</p>
    </Card>
  )
}
