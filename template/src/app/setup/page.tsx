'use client'

import { useCallback, useEffect, useState } from 'react'
import { Logo } from '@/components/Logo'
import { GoogleButton } from '@/components/GoogleButton'
import { PasswordInput } from '@/components/ui/password-input'

// ASSISTANT D'INSTALLATION : la base de données d'abord (ton compte y est enregistré), puis ton compte administrateur.
// La mise en ligne se fait ensuite depuis l'admin (/admin/deploy). Aucun fichier à ouvrir.
type Status = { online: boolean; supabaseReady: boolean; docker: boolean; done: boolean; unlocked: boolean; google: boolean }

const input = 'w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand'

function Check() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" /></svg>
}

function Steps({ current, online }: { current: number; online: boolean }) {
  const steps = [
    { label: 'Base de données', hint: online ? 'installée sur ton serveur' : 'sur cet ordinateur' },
    { label: 'Compte administrateur', hint: 'pour gérer ton SaaS' },
    { label: 'Mise en ligne', hint: online ? 'déjà en ligne' : 'depuis ton admin' },
  ]
  return (
    <ol className="mt-8 grid grid-cols-3 gap-3">
      {steps.map((s, i) => {
        const n = i + 1
        const state = n < current || (online && n === 3) ? 'done' : n === current ? 'current' : 'todo'
        return (
          <li key={s.label} className="flex flex-col gap-2">
            <span className={`h-1 rounded-full ${state === 'todo' ? 'bg-gray-200' : 'bg-brand'}`} />
            <span className="flex items-center gap-2 text-xs font-medium">
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${state === 'done' ? 'bg-brand text-white' : state === 'current' ? 'border-2 border-brand text-brand' : 'border border-gray-300 text-gray-400'}`}>
                {state === 'done' ? <Check /> : n}
              </span>
              <span className={state === 'todo' ? 'text-gray-400' : ''}>{s.label}</span>
            </span>
            <span className="pl-7 text-[11px] text-gray-400">{s.hint}</span>
          </li>
        )
      })}
    </ol>
  )
}

export default function SetupPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [link, setLink] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => fetch('/api/setup', { cache: 'no-store' }).then((r) => r.json()).then(setStatus), [])

  const post = useCallback(async (action: string, extra: Record<string, unknown>, label: string | null) => {
    if (label) setBusy(label)
    setError(null)
    try {
      const res = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) })
      const data = await res.json()
      if (!data.success) { setError(data.message); if (data.code === 'done') refresh(); return null }
      return data
    } catch {
      setError('Le site ne répond pas. Vérifie ta connexion (ou, sur ton ordinateur, que « npm run dev » tourne toujours).')
      return null
    } finally { setBusy(null) }
  }, [refresh])

  const unlock = useCallback(async (token: string) => {
    const data = await post('unlock', { token }, 'Ouverture de l’installation…')
    await refresh()
    return !!data
  }, [post, refresh])

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('token')
      const fromGoogle = params.get('google') === '1'
      if (token || fromGoogle) window.history.replaceState(null, '', '/setup') // le jeton ne reste pas dans l'adresse ni l'historique
      if (token) await unlock(token)
      else await refresh()
      if (fromGoogle) {
        const data = await post('claim', {}, 'Ton compte Google devient le compte administrateur…')
        if (data) window.location.href = '/admin'
      }
    })()
  }, [unlock, refresh, post])

  const openLink = async () => {
    const token = (() => { try { return new URL(link.trim()).searchParams.get('token') } catch { return link.trim() } })()
    if (token) await unlock(token)
  }

  const startDatabase = async () => {
    const data = await post('database', {}, 'Démarrage de la base et création des tables (3 à 10 minutes la première fois : ne ferme pas la page)…')
    if (data) setStatus((s) => s && { ...s, supabaseReady: true })
    else refresh()
  }

  const createAdmin = async () => {
    if (password !== confirmation) return setError('Les deux mots de passe ne sont pas identiques.')
    const data = await post('admin', { email, password }, 'Création de ton compte administrateur…')
    if (data) window.location.href = '/login?next=/admin'
  }

  const step = !status ? 0 : status.done ? 3 : status.supabaseReady ? 2 : 1
  const strength = password.length === 0 ? 0 : password.length < 10 ? 1 : /[A-Z]/.test(password) && /\d/.test(password) && password.length >= 12 ? 3 : 2

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <Logo className="text-lg" />
      <h1 className="mt-8 text-2xl font-bold tracking-tight">Installation de ton SaaS</h1>
      <p className="mt-1 text-sm text-gray-500">
        {status?.online ? 'Ton site est en ligne. Dernière étape : ton compte administrateur.' : 'Trois étapes, sans ouvrir aucun fichier.'}
      </p>

      {status && <Steps current={step} online={status.online} />}

      {busy && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent" />{busy}
        </div>
      )}
      {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {status && !status.unlocked && !status.done && (
        <section className="mt-8 space-y-4 rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold">Ouvre ton lien d’installation</h2>
          <p className="text-sm text-gray-600">
            Pour protéger ton site, l’installation ne s’ouvre qu’avec le lien reçu à la fin de la mise en ligne
            (il se termine par <code className="rounded bg-gray-100 px-1">?token=…</code>). Colle-le ici :
          </p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); openLink() }}>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…/setup?token=…" autoComplete="off" className={input} />
            <button type="submit" disabled={!link.trim() || !!busy} className="shrink-0 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-40">Ouvrir</button>
          </form>
          <p className="text-xs text-gray-400">Lien perdu ? Demande à Claude : « redonne-moi le lien d’installation ».</p>
        </section>
      )}

      {status?.unlocked && step === 1 && (
        <section className="mt-8 space-y-4 rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold">1. Ta base de données</h2>
          <p className="text-sm text-gray-600">
            Elle passe en premier, car ton compte y sera enregistré. Elle tourne sur cet ordinateur (Supabase, open source) :
            aucun compte à créer, rien à payer. À la mise en ligne, la même base est installée sur ton serveur.
          </p>
          {!status.docker && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Docker n’est pas lancé. Ouvre Docker Desktop (à installer une fois depuis docker.com si besoin), attends qu’il soit prêt, puis clique ci-dessous.
            </div>
          )}
          <button type="button" disabled={!!busy} onClick={startDatabase} className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-40">
            Démarrer ma base de données
          </button>
        </section>
      )}

      {status?.unlocked && step === 2 && (
        <section className="mt-8 space-y-5 rounded-2xl border border-gray-200 p-6">
          <div>
            <h2 className="font-semibold">2. Ton compte administrateur</h2>
            <p className="mt-1 text-sm text-gray-600">
              {status.online ? 'La base de données de ton serveur est prête.' : 'Base de données prête, tables créées.'} Ce compte gère ton SaaS : clients, paiements, réglages.
            </p>
          </div>

          {status.google ? (
            <>
              <GoogleButton next="/setup?google=1" label="Continuer avec Google" />
              <div className="flex items-center gap-3 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />ou avec une adresse e-mail<span className="h-px flex-1 bg-gray-200" /></div>
            </>
          ) : (
            <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
              La connexion avec Google s’active ensuite dans Admin → Clés et intégrations → Connexion avec Google. Tu pourras alors te connecter avec Google sur ce même compte (même adresse).
            </p>
          )}

          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createAdmin() }}>
            <div>
              <label htmlFor="setup-email" className="mb-1.5 block text-sm font-medium text-gray-700">Adresse e-mail</label>
              <input id="setup-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" className={input} />
            </div>
            <div>
              <label htmlFor="setup-password" className="mb-1.5 block text-sm font-medium text-gray-700">Mot de passe</label>
              <PasswordInput id="setup-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="10 caractères minimum" />
              <div className="mt-2 flex items-center gap-2">
                {[1, 2, 3].map((n) => <span key={n} className={`h-1 flex-1 rounded-full ${strength >= n ? (strength === 1 ? 'bg-red-400' : strength === 2 ? 'bg-amber-400' : 'bg-green-500') : 'bg-gray-200'}`} />)}
                <span className="w-24 text-right text-[11px] text-gray-500">{['', 'trop court', 'correct', 'solide'][strength]}</span>
              </div>
            </div>
            <div>
              <label htmlFor="setup-confirm" className="mb-1.5 block text-sm font-medium text-gray-700">Confirme le mot de passe</label>
              <PasswordInput id="setup-confirm" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
              {confirmation && confirmation !== password && <p className="mt-1 text-xs text-red-600">Les deux mots de passe sont différents.</p>}
            </div>
            <button type="submit" disabled={!!busy || !email || password.length < 10 || password !== confirmation} className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-40">
              Créer mon compte administrateur
            </button>
          </form>
        </section>
      )}

      {step === 3 && (
        <section className="mt-8 space-y-3 rounded-2xl border border-gray-200 p-6 text-sm">
          <h2 className="font-semibold">Installation terminée</h2>
          <p className="text-gray-600">Ton compte administrateur existe. Connecte-toi pour {status?.online ? 'gérer ton SaaS' : 'le mettre en ligne'}.</p>
          <a href={status?.online ? '/login?next=/admin' : '/login?next=/admin/deploy'} className="inline-block rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-hover">Me connecter</a>
        </section>
      )}
    </main>
  )
}
