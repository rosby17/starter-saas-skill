'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

// Écran du code (deuxième étape de la connexion). Texte adapté à la méthode du compte :
//  - e-mail : le code part tout seul à l'ouverture, « Renvoyer le code » ensuite (6 envois par heure) ;
//  - application : code à 6 chiffres de Google Authenticator, 1Password, Authy…
// Dans les deux cas : « Utiliser un code de secours ».
export function TwoFactorChallenge({ method, maskedEmail, next }: { method: 'email' | 'totp'; maskedEmail: string; next: string }) {
  const router = useRouter()
  const [backup, setBackup] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const sentOnce = useRef(false)

  const send = async () => {
    setSending(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch('/api/account/2fa/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose: 'login' }) })
      const data = await res.json()
      if (data.success) setInfo(data.message)
      else setError(data.message)
    } catch {
      setError('Le code n’a pas pu être envoyé : vérifie ta connexion et réessaie.')
    } finally {
      setSending(false)
    }
  }

  // Méthode e-mail : un seul envoi automatique à l'ouverture de l'écran.
  useEffect(() => {
    if (method !== 'email' || sentOnce.current) return
    sentOnce.current = true
    send()
  }, [method]) // un seul envoi, à l'ouverture de l'écran

  const done = () => { router.replace(next); router.refresh() }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (method === 'totp' && !backup) {
        const supabase = createClient()
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
        if (listError) throw listError
        const factor = factors?.totp.find((f) => f.status === 'verified')
        if (!factor) return setError('Aucune application reliée à ce compte : utilise un code de secours.')
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\D/g, '') })
        if (verifyError) return setError('Code incorrect ou expiré. Saisis le code affiché en ce moment dans ton application.')
        return done()
      }
      const res = await fetch('/api/account/2fa/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, kind: backup ? 'backup' : 'email' }),
      })
      const data = await res.json()
      if (!data.success) return setError(data.message)
      done()
    } catch {
      setError('La vérification n’a pas abouti. Réessaie dans un instant.')
    } finally {
      setBusy(false)
    }
  }

  const title = backup ? 'Code de secours' : method === 'email' ? 'Vérifie ta boîte e-mail' : 'Ouvre ton application'
  const text = backup
    ? 'Saisis un de tes codes de secours (ex. ABCD-EF23). Chaque code ne sert qu’une fois.'
    : method === 'email'
      ? `Nous envoyons un code à 6 chiffres à ${maskedEmail}. Il est valable 10 minutes.`
      : 'Saisis le code à 6 chiffres affiché par ton application d’authentification (Google Authenticator, 1Password, Authy…).'

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-6 text-center">
        <div className="text-2xl"><Logo /></div>
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">{text}</p>
      </div>

      {error && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {info && !error && <div role="status" className="mb-4 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">{info}</div>}

      <form onSubmit={submit} className="space-y-4">
        <Input value={code} onChange={(e) => setCode(e.target.value)} required autoFocus spellCheck={false}
          inputMode={backup ? 'text' : 'numeric'} autoComplete="one-time-code" maxLength={backup ? 12 : 7}
          placeholder={backup ? 'XXXX-XXXX' : '123456'} aria-label={backup ? 'Code de secours' : 'Code à 6 chiffres'}
          className="text-center text-lg tracking-[0.3em]" />
        <Button type="submit" disabled={busy} className="w-full">{busy ? 'Vérification…' : 'Valider'}</Button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm text-gray-600">
        {method === 'email' && !backup && (
          <p><button type="button" onClick={send} disabled={sending} className="font-medium text-brand hover:underline disabled:opacity-50">{sending ? 'Envoi…' : 'Renvoyer le code'}</button></p>
        )}
        <p>
          <button type="button" onClick={() => { setBackup(!backup); setCode(''); setError(null) }} className="hover:underline">
            {backup ? (method === 'email' ? 'Revenir au code reçu par e-mail' : 'Revenir au code de l’application') : 'Utiliser un code de secours'}
          </button>
        </p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-gray-500 hover:underline">Se connecter avec un autre compte</button>
        </form>
      </div>
    </div>
  )
}
