'use client'

import { useEffect, useState } from 'react'
import { clsx } from '@/lib/utils'
import { PasswordInput } from '@/components/ui/password-input'

/** Interrupteur « Connexion avec Google » : applique les clés Google au service de connexion de la base. */
export function GoogleLoginSwitch() {
  const [state, setState] = useState<{ active: boolean; configured: boolean; coolify: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const load = () => fetch('/api/admin/auth/google').then((r) => r.json()).then((d) => d.success && setState(d))
  useEffect(() => { load() }, [])

  // Jeton Coolify refusé ou absent : on le colle ICI (enregistré comme les autres clés), puis on réactive d'un coup.
  const [token, setToken] = useState('')
  const needsToken = !!state && (!state.coolify || (!!message && !message.ok && /coolify|jeton|401/i.test(message.text)))

  const apply = async (enabled: boolean) => {
    setBusy(true); setMessage(null)
    const d = await fetch('/api/admin/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) }).then((r) => r.json()).catch(() => ({ success: false }))
    setBusy(false)
    setMessage({ ok: !!d.success, text: d.message || (d.success ? 'Fait.' : 'Échec.') })
    if (!d.success) return
    // L'interrupteur bascule tout de suite ; on revérifie ensuite toutes les 10 s que le service a bien redémarré.
    setState((st) => (st ? { ...st, active: enabled } : st))
    let tries = 0
    const poll = setInterval(async () => {
      tries++
      const r = await fetch('/api/admin/auth/google').then((x) => x.json()).catch(() => null)
      if (r?.success && r.active === enabled) { clearInterval(poll); setState(r); setMessage({ ok: true, text: enabled ? 'Connexion Google active : le bouton est affiché sur la connexion et l’inscription.' : 'Connexion Google désactivée.' }) }
      else if (tries > 18) clearInterval(poll)
    }, 10_000)
  }

  const saveTokenAndEnable = async () => {
    if (!token.trim()) return
    setBusy(true); setMessage(null)
    const values: Record<string, string> = { COOLIFY_API_TOKEN: token.trim() }
    if (!state?.coolify) { const host = window.location.hostname.split('.').slice(-2).join('.'); if (host.includes('.')) values.COOLIFY_URL = `https://coolify.${host}` }
    const d = await fetch('/api/admin/secrets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }) }).then((r) => r.json()).catch(() => ({ success: false }))
    if (!d.success) { setBusy(false); return setMessage({ ok: false, text: d.message || 'Jeton non enregistré.' }) }
    setToken('')
    await load()
    await apply(true)
  }

  // Un clic active, un clic désactive (le service de connexion redémarre ensuite pendant environ 1 minute).
  const toggle = async () => {
    if (!state) return
    await apply(!state.active)
  }

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-surface p-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logos/services/google.svg" alt="" className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Connexion avec Google</p>
        <p className="text-sm text-gray-500">
          {!state ? 'Vérification…' : state.active ? 'Active : le bouton « Continuer avec Google » est affiché sur les pages de connexion.'
            : state.configured ? 'Tes clés Google sont enregistrées, mais la connexion n’est pas encore activée.' : 'Colle d’abord l’ID client et le code secret Google (tuile Google ci-dessous).'}
        </p>
        {message && <p className={clsx('mt-1 text-sm', message.ok ? 'text-green-700' : 'text-red-700')}>{message.text}</p>}
        {needsToken && state?.configured && (
          <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm text-gray-700">Colle ici ton nouveau jeton Coolify (ton tableau de bord Coolify → Keys &amp; Tokens → API tokens → Create, droit « root ») :</p>
            <div className="flex flex-wrap gap-2">
              <div className="min-w-56 flex-1"><PasswordInput value={token} onChange={(e) => setToken(e.target.value)} placeholder="Jeton API Coolify" autoComplete="off" /></div>
              <button type="button" onClick={saveTokenAndEnable} disabled={busy || !token.trim()} className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">{busy ? 'Un instant…' : 'Enregistrer et activer Google'}</button>
            </div>
          </div>
        )}
      </div>
      <button type="button" role="switch" aria-checked={!!state?.active} disabled={!state || busy || (!state.active && !state.configured)} onClick={toggle}
        className={clsx('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50', state?.active ? 'bg-green-600' : 'bg-gray-300')}>
        <span className={clsx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', state?.active ? 'left-6' : 'left-1')} />
      </button>
    </section>
  )
}
