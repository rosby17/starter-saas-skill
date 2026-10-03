'use client'

import { useEffect, useState } from 'react'
import { Logo } from '@/components/Logo'

// ASSISTANT DE DÉMARRAGE : 2 étapes ici, la 3e (mise en ligne) dans /admin/deploy, sans ouvrir aucun fichier.
// 1) La base de données : Supabase open source dans Docker, sur cet ordinateur (aucun compte à créer).
// 2) Le compte administrateur.
type Status = { supabaseReady: boolean; docker: boolean; done: boolean; tokenConfigured: boolean }

export default function SetupPage() {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => fetch('/api/setup').then((r) => r.json()).then(setStatus)

  useEffect(() => {
    // Le lien donné par Claude contient ?token=… : on le garde pour la session et on l'efface de l'adresse.
    const fromUrl = new URLSearchParams(window.location.search).get('token')
    if (fromUrl) { sessionStorage.setItem('setup-token', fromUrl); window.history.replaceState(null, '', '/setup') }
    setToken(fromUrl || sessionStorage.getItem('setup-token') || '')
    refresh()
  }, [])

  const post = async (action: string, extra: Record<string, unknown>, label: string) => {
    setBusy(label); setError(null)
    try {
      const res = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, token, ...extra }) })
      const data = await res.json()
      if (!data.success) { setError(data.message); return null }
      return data
    } catch {
      setError('Le serveur local ne répond pas : vérifie que « npm run dev » tourne toujours.')
      return null
    } finally { setBusy(null) }
  }

  const startDatabase = async () => {
    const data = await post('database', {}, 'Démarrage de la base et création des tables (3 à 10 minutes la première fois : ne ferme pas la page)…')
    if (data) setStatus((s) => s && { ...s, supabaseReady: true })
    else refresh()
  }

  const createAdmin = async () => {
    const data = await post('admin', { email, password }, 'Création de ton compte administrateur…')
    if (data) { sessionStorage.removeItem('setup-token'); window.location.href = '/login?next=/admin/deploy' }
  }

  const step = !status ? 0 : status.done ? 3 : status.supabaseReady ? 2 : 1

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <Logo className="text-lg" />
      <h1 className="mt-8 text-2xl font-bold">Installation de ton SaaS</h1>
      <p className="mt-1 text-sm text-gray-500">Trois étapes. Tu colles, tu cliques : aucun fichier à ouvrir.</p>

      <ol className="mt-6 flex gap-2 text-xs">
        {['Base de données', 'Compte administrateur', 'Mise en ligne'].map((label, i) => (
          <li key={label} className={`flex-1 rounded-full px-3 py-1.5 text-center ${step > i + 1 ? 'bg-brand/10 text-brand' : step === i + 1 ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}. {label}</li>
        ))}
      </ol>

      {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {busy && <div className="mt-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"><span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />{busy}</div>}

      {status && !status.tokenConfigured && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">SETUP_TOKEN absent : demande à Claude de relancer l’installation.</div>
      )}

      {step === 1 && (
        <section className="mt-8 space-y-4 rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold">1. Ta base de données</h2>
          <p className="text-sm text-gray-600">
            Elle tourne sur cet ordinateur (Supabase, open source) : aucun compte à créer, rien à payer.
            À la mise en ligne, la même base est installée sur ton serveur.
          </p>
          {!status?.docker && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Docker n’est pas lancé. Ouvre Docker Desktop (à installer une fois depuis docker.com si besoin), attends qu’il soit prêt, puis clique ci-dessous.
            </div>
          )}
          <button type="button" disabled={!!busy} onClick={startDatabase} className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-40">
            Démarrer ma base de données
          </button>
        </section>
      )}

      {step === 2 && (
        <form className="mt-8 space-y-4 rounded-2xl border border-gray-200 p-6" onSubmit={(e) => { e.preventDefault(); createAdmin() }}>
          <h2 className="font-semibold">2. Ton compte administrateur</h2>
          <p className="text-sm text-gray-600">Base de données prête, tables créées. Choisis l’adresse et le mot de passe avec lesquels tu géreras ton SaaS.</p>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.com" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe (10 caractères minimum)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none" />
          <button type="submit" disabled={!!busy || !email || password.length < 10} className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-40">Créer mon compte et continuer</button>
        </form>
      )}

      {step === 3 && (
        <section className="mt-8 rounded-2xl border border-gray-200 p-6 text-sm">
          <p>Installation terminée.</p>
          <a href="/login?next=/admin/deploy" className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-hover">Me connecter et mettre en ligne</a>
        </section>
      )}
    </main>
  )
}
