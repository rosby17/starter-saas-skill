'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RadioCard } from '@/components/ui/choice'
import { useConfirm } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'

type Method = 'email' | 'totp'
type Status = { method: Method | null; pending: Method | null; backupCodesLeft: number }

const METHOD_LABEL: Record<Method, string> = { email: 'par e-mail', totp: 'avec une application' }

// Mon compte › Validation en deux étapes : au choix « Par e-mail » (code à 6 chiffres à chaque connexion)
// ou « Avec une application » (TOTP de Supabase Auth). Codes de secours dans les deux cas, montrés une seule fois.
export function TwoFactorSettings() {
  const [status, setStatus] = useState<Status | null>(null)
  const [choosing, setChoosing] = useState<Method | null>(null)
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [totp, setTotp] = useState<{ factorId: string; qr: string; secret: string } | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/account/2fa')
      const data = await res.json()
      if (data.success) setStatus({ method: data.method, pending: data.pending, backupCodesLeft: data.backupCodesLeft })
      else setError(data.message)
    } catch {
      setError('Impossible de lire l’état de la validation en deux étapes.')
    }
  }, [])
  useEffect(() => { load() }, [load])

  const reset = () => { setChoosing(null); setCode(''); setCodeSent(false); setTotp(null) }

  const post = async (action: string, body: object = {}) => {
    const res = await fetch(`/api/account/2fa/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res.json() as Promise<{ success: boolean; message?: string; backupCodes?: string[] }>
  }

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setInfo(null)
    try { await task() } catch (e) { setError(e instanceof Error && e.message ? e.message : 'L’opération n’a pas abouti. Réessaie.') } finally { setBusy(false) }
  }

  const sendCode = () => run(async () => {
    const data = await post('send', { purpose: 'enable' })
    if (!data.success) throw new Error(data.message)
    setCodeSent(true)
    setInfo(data.message ?? 'Code envoyé.')
  })

  const startTotp = () => run(async () => {
    const supabase = createClient()
    // Une tentative abandonnée laisse une application « non vérifiée » : on la retire avant d'en relier une nouvelle.
    const { data: list } = await supabase.auth.mfa.listFactors()
    for (const f of list?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Application ${new Date().toLocaleString('fr-FR')}` })
    if (enrollError || !data) throw new Error(`L’application n’a pas pu être reliée : ${enrollError?.message ?? 'réponse vide'}. (La validation par application doit être activée sur la base.)`)
    setTotp({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  })

  const activate = () => run(async () => {
    let data
    if (choosing === 'totp') {
      if (!totp) throw new Error('Affiche d’abord le QR code.')
      const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId: totp.factorId, code: code.replace(/\D/g, '') })
      if (verifyError) throw new Error('Code incorrect : saisis le code affiché en ce moment dans l’application.')
      data = await post('enable-totp')
    } else {
      data = await post('enable-email', { code })
    }
    if (!data.success) throw new Error(data.message)
    setBackupCodes(data.backupCodes ?? null)
    reset()
    await load()
  })

  const newCodes = () => run(async () => {
    if (!(await confirm({ title: 'Générer de nouveaux codes de secours ?', message: 'Les anciens codes ne marcheront plus.', confirmLabel: 'Générer' }))) return
    const data = await post('backup-codes')
    if (!data.success) throw new Error(data.message)
    setBackupCodes(data.backupCodes ?? null)
    await load()
  })

  const disable = () => run(async () => {
    if (!(await confirm({ title: 'Désactiver la validation en deux étapes ?', message: 'Ton mot de passe suffira de nouveau pour te connecter. Tes codes de secours seront effacés.', confirmLabel: 'Désactiver', danger: true }))) return
    const data = await post('disable')
    if (!data.success) throw new Error(data.message)
    setInfo('Validation en deux étapes désactivée.')
    await load()
  })

  const copyCodes = async () => {
    if (!backupCodes) return
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'))
      setInfo('Codes copiés. Range-les dans un endroit sûr (gestionnaire de mots de passe, papier).')
    } catch {
      setError('Copie impossible : sélectionne les codes et copie-les à la main.')
    }
  }

  if (!status) return <p className="text-sm text-gray-500">{error ?? 'Chargement…'}</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {status.method ? <Badge tone="green">Activée {METHOD_LABEL[status.method]}</Badge> : <Badge>Désactivée</Badge>}
        {status.method && <span className="text-sm text-gray-500">{status.backupCodesLeft} code{status.backupCodesLeft > 1 ? 's' : ''} de secours restant{status.backupCodesLeft > 1 ? 's' : ''}</span>}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {info && <div role="status" className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">{info}</div>}

      {backupCodes && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">Tes codes de secours</p>
          <p className="mt-1 text-sm text-amber-800">Ils te permettent d’entrer si tu n’as plus accès à {status.method === 'totp' ? 'ton application' : 'ta boîte e-mail'}. Chaque code ne sert qu’une fois. Ils ne seront plus affichés.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
            {backupCodes.map((c) => <li key={c} className="select-all rounded-lg bg-surface px-3 py-1.5 text-center">{c}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={copyCodes}>Copier les codes</Button>
            <Button type="button" onClick={() => setBackupCodes(null)}>J’ai noté mes codes</Button>
          </div>
        </div>
      )}

      {!choosing && (
        <div className="flex flex-wrap gap-2">
          {!status.method && <>
            <Button type="button" onClick={() => setChoosing('email')}>Activer par e-mail</Button>
            <Button type="button" variant="secondary" onClick={() => setChoosing('totp')}>Activer avec une application</Button>
          </>}
          {status.method && <>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setChoosing(status.method === 'email' ? 'totp' : 'email')}>
              Passer {status.method === 'email' ? 'à une application' : 'à l’e-mail'}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={newCodes}>Nouveaux codes de secours</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={disable}>Désactiver</Button>
          </>}
        </div>
      )}

      {choosing && (
        <div className="space-y-4 rounded-xl border border-gray-200 p-4">
          <div role="radiogroup" aria-label="Méthode" className="space-y-2">
            <RadioCard checked={choosing === 'email'} onSelect={() => { reset(); setChoosing('email') }} label="Par e-mail" description="un code à 6 chiffres à chaque connexion" />
            <RadioCard checked={choosing === 'totp'} onSelect={() => { reset(); setChoosing('totp') }} label="Avec une application" description="Google Authenticator, 1Password, Authy…" />
          </div>

          {choosing === 'email' && !codeSent && (
            <Button type="button" disabled={busy} onClick={sendCode}>{busy ? 'Envoi…' : 'M’envoyer le code'}</Button>
          )}
          {choosing === 'totp' && !totp && (
            <Button type="button" disabled={busy} onClick={startTotp}>{busy ? 'Préparation…' : 'Afficher le QR code'}</Button>
          )}
          {choosing === 'totp' && totp && (
            <div className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR code fourni en data URL par Supabase */}
              <img src={totp.qr} alt="QR code à scanner avec ton application" width={160} height={160} className="rounded-lg border border-gray-200 bg-surface p-2" />
              <div className="min-w-0 flex-1 text-sm text-gray-600">
                <p>Scanne ce QR code avec ton application, puis saisis le code à 6 chiffres qu’elle affiche.</p>
                <p className="mt-2">Pas de caméra ? Saisis cette clé : <code className="select-all break-all font-mono text-gray-900">{totp.secret}</code></p>
              </div>
            </div>
          )}

          {((choosing === 'email' && codeSent) || (choosing === 'totp' && totp)) && (
            <form onSubmit={(e) => { e.preventDefault(); activate() }} className="flex flex-wrap gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} required
                placeholder="Code à 6 chiffres" aria-label="Code à 6 chiffres" className="max-w-48 tracking-widest" />
              <Button type="submit" disabled={busy}>{busy ? 'Vérification…' : 'Activer'}</Button>
              {choosing === 'email' && <Button type="button" variant="ghost" disabled={busy} onClick={sendCode}>Renvoyer</Button>}
            </form>
          )}
          <button type="button" onClick={reset} className="text-sm text-gray-500 hover:underline">Annuler</button>
        </div>
      )}
    </div>
  )
}
