'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useConfirm } from '@/components/ui/dialog'
import { PasswordInput } from '@/components/ui/password-input'
import { GoogleLoginSwitch } from '@/components/admin/GoogleLoginSwitch'
import { FALLBACK_LOGO, SERVICES, THEMES, themeOf } from '@/lib/secrets/services'
import type { SecretStatus } from '@/lib/secrets/store'

// Clés et intégrations, sur toute la largeur : compteurs, recherche et filtres en haut, sommaire collant à gauche
// rangé par thèmes (logo de chaque service), services en colonnes au centre, une carte par clé avec sa pastille d'état.
// Les clés sont chiffrées en base et actives dès l'enregistrement (pas de redéploiement).
// Thèmes, logos et liens « Où la trouver » : src/lib/secrets/services.ts. Clé cachée (`hidden` dans catalog.ts) : jamais affichée ni comptée.

type Secret = SecretStatus
type Filter = 'toutes' | 'a-faire' | 'renseignees'
type State = 'ok' | 'manquante' | 'ressaisir' | 'vide'

const randomSecret = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const stateOf = (s: Secret): State =>
  s.unreadable ? 'ressaisir' : s.source !== 'missing' ? 'ok' : s.required ? 'manquante' : 'vide'

const PILL: Record<State, { label: string; cls: string; dot: string }> = {
  ok: { label: 'Active', cls: 'bg-green-50 text-green-700 ring-green-200', dot: 'bg-green-500' },
  manquante: { label: 'Manquante', cls: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  ressaisir: { label: 'À ressaisir', cls: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
  vide: { label: 'Facultative', cls: 'bg-gray-100 text-gray-500 ring-gray-200', dot: 'bg-gray-300' },
}

// Empêche les gestionnaires de mots de passe (Chrome, 1Password, LastPass, Bitwarden) de s'accrocher aux champs de clés.
const NO_AUTOFILL = { autoComplete: 'off', spellCheck: false, 'data-1p-ignore': true, 'data-lpignore': 'true', 'data-bwignore': true, 'data-form-type': 'other' } as const

const visibleOnly = (list: Secret[]) => list.filter((s) => !s.hidden)
const slug = (g: string) => 'service-' + g.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
const themeIndex = (g: string) => THEMES.findIndex((t) => t.id === themeOf(g))

/** Logo officiel (ou pictogramme) sur pastille blanche : lisible en clair comme en sombre. */
function ServiceLogo({ group, size = 'md' }: { group: string; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 20 : 36
  const inner = size === 'sm' ? 14 : 24
  return (
    <span className={`grid shrink-0 place-items-center border border-gray-200 bg-white ${size === 'sm' ? 'rounded-md' : 'rounded-xl'}`} style={{ width: px, height: px }}>
      <Image src={SERVICES[group]?.logo ?? FALLBACK_LOGO} alt="" width={inner} height={inner} unoptimized className="object-contain" style={{ width: inner, height: inner }} />
    </span>
  )
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-xs">
      <p className="text-gray-500">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate text-gray-800">{value}</code>
        <button type="button" onClick={() => { navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500) }}
          className="shrink-0 rounded-md border border-gray-200 bg-surface px-2 py-0.5 font-medium text-gray-600 hover:border-brand hover:text-brand">
          {done ? 'Copiée' : 'Copier'}
        </button>
      </div>
    </div>
  )
}

export default function KeysPage() {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [initial, setInitial] = useState('')
  const [prefilling, setPrefilling] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [origin, setOrigin] = useState('')
  const [filter, setFilter] = useState<Filter>('toutes')
  const [query, setQuery] = useState('')
  const focusDone = useRef(false)
  const confirm = useConfirm()

  // Champ PRÉ-REMPLI avec la valeur en place (ou la valeur par défaut du code) : on voit (œil pour un secret) et on corrige.
  const open = async (s: Secret) => {
    setEditing(s.name); setValue(''); setInitial(''); setMessage(null)
    if (s.source === 'missing' && !s.defaultValue) return
    setPrefilling(true)
    try {
      const data = await fetch(`/api/admin/secrets?values=${encodeURIComponent(s.name)}`, { cache: 'no-store' }).then((r) => r.json())
      if (data.success) { setValue(data.values[s.name] ?? ''); setInitial(data.values[s.name] ?? '') }
    } catch { /* champ vide : la personne colle la valeur */ }
    setPrefilling(false)
  }

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch('/api/admin/secrets').then((r) => r.json()).then((data) => {
      if (!data.success) return setMessage({ ok: false, text: data.message })
      const list = visibleOnly(data.secrets)
      setSecrets(list)
      // Lien « Renseigner » du bandeau (?focus=NOM_DE_CLE) : ouvre la bonne carte une seule fois.
      if (focusDone.current) return
      focusDone.current = true
      const focus = new URLSearchParams(window.location.search).get('focus') || window.location.hash.slice(1)
      const target = list.find((s) => s.name === focus)
      if (target) {
        open(target)
        setTimeout(() => document.getElementById(target.name)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100)
      }
    }).catch(() => setMessage({ ok: false, text: 'Impossible de lire les clés. Vérifie ta connexion et recharge la page.' }))
      .finally(() => setLoaded(true))
  }, [])

  // Les messages de réussite se ferment seuls ; une erreur reste jusqu'au clic sur la croix.
  useEffect(() => {
    if (!message?.ok) return
    const t = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(t)
  }, [message])

  const close = () => { setEditing(null); setValue(''); setInitial('') }

  const save = async (s: Secret) => {
    if (value.trim() === initial.trim()) return close()
    setBusy(true)
    const res = await fetch('/api/admin/secrets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: s.name, value: value.trim() }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    setBusy(false)
    if (!data?.success) return setMessage({ ok: false, text: data?.message ?? 'Le serveur n’a pas répondu.' })
    setSecrets(visibleOnly(data.secrets))
    close()
    setMessage({ ok: true, text: `${s.label} enregistrée et active.` })
  }

  const reset = async (s: Secret) => {
    if (!(await confirm({ title: `Effacer ${s.label.toLowerCase()} ?`, message: 'Le site reprendra la valeur du serveur, s’il y en a une.', confirmLabel: 'Effacer', danger: true }))) return
    const data = await fetch(`/api/admin/secrets?name=${encodeURIComponent(s.name)}`, { method: 'DELETE' }).then((r) => r.json()).catch(() => null)
    if (!data?.success) return setMessage({ ok: false, text: data?.message ?? 'Suppression impossible.' })
    setSecrets(visibleOnly(data.secrets))
    if (editing === s.name) close()
    setMessage({ ok: true, text: `${s.label} effacée.` })
  }

  const stats = useMemo(() => {
    const by = (st: State) => secrets.filter((s) => stateOf(s) === st)
    return { ok: by('ok'), manquante: by('manquante'), ressaisir: by('ressaisir'), vide: by('vide') }
  }, [secrets])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return secrets.filter((s) => {
      const st = stateOf(s)
      if (filter === 'a-faire' && st !== 'manquante' && st !== 'ressaisir') return false
      if (filter === 'renseignees' && st !== 'ok') return false
      return !q || [s.label, s.name, s.group, s.help].some((t) => t.toLowerCase().includes(q))
    })
  }, [secrets, filter, query])

  const allGroups = [...new Set(secrets.map((s) => s.group))].sort((a, b) => themeIndex(a) - themeIndex(b))
  const groups = allGroups.filter((g) => visible.some((s) => s.group === g))
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: 'toutes', label: 'Toutes', count: secrets.length },
    { id: 'a-faire', label: 'À faire', count: stats.manquante.length + stats.ressaisir.length },
    { id: 'renseignees', label: 'Renseignées', count: stats.ok.length },
  ]

  return (
    <main className="p-4 md:p-8">
      {/* En-tête : titre à gauche, recherche et filtres à droite */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-4xl">Clés et intégrations</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Colle ici les clés de tes services. Elles sont chiffrées dans la base et actives dès l&apos;enregistrement.
            Une clé saisie ici remplace celle du serveur.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" name="recherche-cles" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher une clé, un service…" aria-label="Chercher une clé" {...NO_AUTOFILL}
              className="w-full rounded-xl border border-gray-200 bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand sm:w-72" />
          </div>
          <div className="flex rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Filtrer les clés">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${filter === f.id ? 'bg-surface text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                {f.label} <span className="ml-1 text-xs text-gray-400">{f.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quatre compteurs : un clic filtre la liste */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ['Actives', stats.ok.length, `sur ${secrets.length} clés`, 'text-green-700', 'ok'],
          ['Manquantes', stats.manquante.length, 'pour ce qui est activé', stats.manquante.length ? 'text-amber-700' : 'text-gray-300', 'manquante'],
          ['À ressaisir', stats.ressaisir.length, 'illisibles, à recoller', stats.ressaisir.length ? 'text-red-700' : 'text-gray-300', 'ressaisir'],
          ['Facultatives vides', stats.vide.length, 'services non branchés', 'text-gray-400', 'vide'],
        ] as const).map(([label, n, sub, color, st]) => (
          <button key={label} type="button" onClick={() => setFilter(st === 'ok' ? 'renseignees' : st === 'vide' ? 'toutes' : 'a-faire')}
            className="rounded-2xl border border-gray-200 bg-surface p-4 text-left transition hover:border-brand">
            <p className="flex items-center gap-2 text-xs font-medium text-gray-500"><span className={`h-2 w-2 rounded-full ${PILL[st].dot}`} />{label}</p>
            <p className={`mt-2 text-3xl font-bold tabular-nums ${color}`}>{loaded ? n : '·'}</p>
            <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
          </button>
        ))}
      </div>

      {stats.manquante.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          À renseigner pour ce qui est activé :{' '}
          {stats.manquante.map((s, i) => (
            <span key={s.name}>{i > 0 && ', '}<a href={`#${s.name}`} onClick={() => open(s)} className="font-semibold underline">{s.group} : {s.label}</a></span>
          ))}
          .
        </div>
      )}

      {/* Messages en bas à droite : la réussite se ferme seule, l'erreur reste */}
      {message && (
        <div role="status" className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl bg-surface shadow-lg">
          <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${message.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
            <span className="flex-1">{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} aria-label="Fermer" className="opacity-60 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
        {/* Sommaire collant, rangé par thèmes */}
        <nav aria-label="Services" className="hidden lg:block">
          <div className="sticky top-6">
            {THEMES.filter((t) => allGroups.some((g) => themeOf(g) === t.id)).map((t) => (
              <div key={t.id} className="pb-4">
                <a href={`#theme-${t.id}`} className="mb-1 block px-3 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-700">{t.title}</a>
                {allGroups.filter((g) => themeOf(g) === t.id).map((g) => {
                  const items = secrets.filter((s) => s.group === g)
                  const okN = items.filter((s) => stateOf(s) === 'ok').length
                  const alert = items.some((s) => stateOf(s) === 'manquante' || stateOf(s) === 'ressaisir')
                  return (
                    <a key={g} href={`#${slug(g)}`} className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition hover:bg-gray-100 ${groups.includes(g) ? '' : 'opacity-40'}`}>
                      <ServiceLogo group={g} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-gray-700">{g}</span>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${alert ? 'bg-amber-500' : okN === items.length ? 'bg-green-500' : okN ? 'bg-green-300' : 'bg-gray-300'}`} />
                      <span className="w-7 text-right text-xs tabular-nums text-gray-400">{okN}/{items.length}</span>
                    </a>
                  )
                })}
              </div>
            ))}
          </div>
        </nav>

        <div>
          {loaded && secrets.length > 0 && groups.length === 0 && (
            <p className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">Aucune clé ne correspond.</p>
          )}
          {!loaded && (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />)}
            </div>
          )}

          {THEMES.filter((t) => groups.some((g) => themeOf(g) === t.id)).map((theme) => {
            const tGroups = groups.filter((g) => themeOf(g) === theme.id)
            const tAll = secrets.filter((s) => themeOf(s.group) === theme.id)
            const tOk = tAll.filter((s) => stateOf(s) === 'ok').length
            return (
              <div key={theme.id} id={`theme-${theme.id}`} className="mb-12 scroll-mt-6">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-gray-200 pb-3">
                  <div>
                    <h2 className="text-xl font-bold">{theme.title}</h2>
                    <p className="mt-0.5 text-sm text-gray-500">{theme.desc}</p>
                  </div>
                  <span className="text-sm tabular-nums text-gray-400">{tOk} sur {tAll.length} clés actives</span>
                </div>

                {/* Services en colonnes : les petits services remplissent la largeur */}
                <div className="gap-6 md:columns-2 2xl:columns-3">
                  {tGroups.map((group) => {
                    const all = secrets.filter((s) => s.group === group)
                    const items = visible.filter((s) => s.group === group)
                    const okN = all.filter((s) => stateOf(s) === 'ok').length
                    const info = SERVICES[group]
                    return (
                      <section key={group} id={slug(group)} className="mb-8 break-inside-avoid scroll-mt-6">
                        <div className="mb-3 flex items-center gap-3">
                          <ServiceLogo group={group} />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-base font-semibold">{group}</h3>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="h-1.5 max-w-24 flex-1 overflow-hidden rounded-full bg-gray-100">
                                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${(okN / all.length) * 100}%` }} />
                              </div>
                              <span className="text-xs tabular-nums text-gray-400">{okN} sur {all.length} active{okN > 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                        {info && (
                          <p className="mb-4 text-xs leading-relaxed text-gray-500">
                            {info.description}
                            {info.where && <> Où la trouver : <a href={info.where.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline-offset-2 hover:underline">{info.where.label}</a>.</>}
                          </p>
                        )}

                        <div className="space-y-3">
                          {items.map((s) => {
                            const st = stateOf(s)
                            const isEditing = editing === s.name
                            const fieldProps = {
                              autoFocus: true, value, disabled: prefilling, name: `cle-${s.name.toLowerCase()}`,
                              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
                              placeholder: prefilling ? 'Chargement…' : `Colle ${s.label.toLowerCase()}`, ...NO_AUTOFILL,
                            }
                            return (
                              <article key={s.name} id={s.name}
                                className={`flex scroll-mt-24 flex-col rounded-2xl border bg-surface p-5 transition ${isEditing ? 'border-brand ring-4 ring-brand/10' : st === 'manquante' ? 'border-amber-200' : st === 'ressaisir' ? 'border-red-200' : 'border-gray-200 hover:border-gray-300'}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <h4 className="font-semibold text-gray-900">{s.label}</h4>
                                    <code className="mt-0.5 block truncate text-[11px] text-gray-400">{s.name}</code>
                                  </div>
                                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${PILL[st].cls}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${PILL[st].dot}`} />{PILL[st].label}
                                  </span>
                                </div>

                                {s.preview && (
                                  <p className="mt-3 flex items-center gap-2 text-xs">
                                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-500">{s.source === 'admin' ? 'ici' : 'serveur'}</span>
                                    <code className="min-w-0 truncate text-gray-700">{s.preview}</code>
                                  </p>
                                )}

                                <p className="mt-3 text-xs leading-relaxed text-gray-500">{s.help}</p>
                                {s.oauthCallback && <CopyLine label="Adresse de redirection à déclarer chez Google" value={`${supabaseUrl}/auth/v1/callback`} />}
                                {s.webhookPath && origin && <CopyLine label="Adresse du webhook à déclarer" value={`${origin}${s.webhookPath}`} />}

                                {isEditing ? (
                                  <form className="mt-4 space-y-3" autoComplete="off" onSubmit={(e) => { e.preventDefault(); save(s) }}>
                                    {s.secret
                                      ? <PasswordInput {...fieldProps} className="font-mono" />
                                      : <input {...fieldProps} className="w-full rounded-lg border border-gray-200 bg-surface px-4 py-2.5 font-mono text-sm outline-none focus:border-brand" />}
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                      {s.generate && (
                                        <button type="button" onClick={() => setValue(randomSecret())} className="mr-auto rounded-lg border border-gray-200 px-3 py-2 text-sm hover:border-brand">Générer</button>
                                      )}
                                      <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800">Annuler</button>
                                      <button type="submit" disabled={busy || prefilling || !value.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-40">
                                        {busy ? 'Enregistrement…' : 'Enregistrer'}
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <div className="mt-auto flex items-center gap-2 pt-4">
                                    <button type="button" onClick={() => open(s)}
                                      className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${s.source === 'missing' || s.unreadable ? 'bg-brand text-on-brand hover:bg-brand-hover' : 'border border-gray-200 text-gray-700 hover:border-brand hover:text-brand'}`}>
                                      {s.source === 'missing' ? 'Renseigner' : s.unreadable ? 'Ressaisir' : 'Modifier'}
                                    </button>
                                    {s.source === 'admin' && (
                                      <button type="button" onClick={() => reset(s)} className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-red-50 hover:text-red-700">Effacer</button>
                                    )}
                                  </div>
                                )}
                              </article>
                            )
                          })}
                        </div>
                        {group === 'Connexion avec Google' && <div className="mt-3"><GoogleLoginSwitch /></div>}
                      </section>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
