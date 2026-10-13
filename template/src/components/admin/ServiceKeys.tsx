'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { useConfirm } from '@/components/ui/dialog'
import { OTHER_SERVICE, SERVICES, type ServiceDefinition } from '@/lib/secrets/services'
import type { SecretStatus } from '@/lib/secrets/store'
import { clsx } from '@/lib/utils'

// Briques communes de « Clés et intégrations » et « Moyens de paiement » : logo d'un service,
// tuile avec son état, fenêtre de saisie des clés.

export type Secret = SecretStatus

/** Logo officiel (ou pictogramme) dans une pastille blanche 48×48 : jamais une lettre dans un carré coloré. */
export function ServiceLogo({ service, size = 48 }: { service: Pick<ServiceDefinition, 'logo' | 'name'>; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-xl border border-gray-200 bg-surface" style={{ width: size, height: size }}>
      <Image src={service.logo} alt={`Logo ${service.name}`} width={Math.round(size * 0.66)} height={Math.round(size * 0.66)} unoptimized
        className="object-contain" style={{ width: Math.round(size * 0.66), height: Math.round(size * 0.66) }} />
    </span>
  )
}

export type ServiceWithKeys = ServiceDefinition & { secrets: Secret[] }

/** Associe chaque service à l'état de ses clés ; les clés sans service vont dans « Autres réglages ». */
export function servicesWithKeys(secrets: Secret[]): ServiceWithKeys[] {
  const byName = new Map(secrets.map((s) => [s.name, s]))
  const listed = new Set(SERVICES.flatMap((s) => s.keys))
  const list: ServiceWithKeys[] = SERVICES.map((s) => ({ ...s, secrets: s.keys.map((k) => byName.get(k)).filter((x): x is Secret => !!x) }))
  const others = secrets.filter((s) => !listed.has(s.name))
  if (others.length) list.push({ ...OTHER_SERVICE, keys: others.map((s) => s.name), secrets: others })
  return list.filter((s) => s.secrets.length)
}

export type ServiceState = { ready: boolean; done: number; total: number; required: boolean; optional: boolean }

/** Configuré = toutes les clés utiles renseignées (les clés facultatives ne comptent que si le service n'a que celles-là). */
export function serviceState(service: ServiceWithKeys): ServiceState {
  const essential = service.secrets.filter((s) => !s.optional)
  const counted = essential.length ? essential : service.secrets
  const done = counted.filter((s) => s.source !== 'missing' && !s.unreadable).length
  const required = service.secrets.some((s) => s.required)
  return { ready: done === counted.length, done, total: counted.length, required, optional: !required }
}

export function ServiceBadge({ state }: { state: ServiceState }) {
  if (state.ready) return <Badge tone="green">Configuré</Badge>
  if (state.done) return <Badge tone="amber">{state.done} sur {state.total}</Badge>
  return state.required ? <Badge tone="red">À configurer</Badge> : <Badge>Facultatif</Badge>
}

/** Tuile d'un service : logo, nom, état, description, bouton. */
export function ServiceTile({ service, onOpen, extra }: { service: ServiceWithKeys; onOpen: () => void; extra?: React.ReactNode }) {
  const state = serviceState(service)
  return (
    <div className={clsx('flex flex-col gap-3 rounded-2xl border bg-surface p-5', state.ready ? 'border-green-200' : 'border-gray-200')}>
      <div className="flex items-center gap-3">
        <ServiceLogo service={service} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{service.name}</p>
          <ServiceBadge state={state} />
        </div>
      </div>
      <p className="flex-1 text-sm text-gray-500">{service.description}</p>
      {extra}
      <Button type="button" variant={state.ready ? 'secondary' : 'primary'} onClick={onOpen} className="self-start">
        {state.ready ? 'Modifier' : 'Configurer'}
      </Button>
    </div>
  )
}

const randomSecret = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Charge l'état des clés (GET /api/admin/secrets) et expose l'enregistrement. */
export function useSecrets() {
  const [secrets, setSecrets] = useState<Secret[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/secrets')
      const data = await res.json()
      if (data.success) setSecrets(data.secrets)
      else setError(data.message)
    } catch {
      setError('Impossible de lire les clés. Vérifie ta connexion et recharge la page.')
    }
  }, [])
  useEffect(() => { reload() }, [reload])
  return { secrets, setSecrets, error, reload }
}

/** Fenêtre d'un service : lien « Où la trouver », un champ par clé, Annuler / Enregistrer. */
export function ServiceModal({ service, onClose, onSaved }: {
  service: ServiceWithKeys | null
  onClose: () => void
  onSaved: (secrets: Secret[], message: string) => void
}) {
  // Champs pré-remplis avec la valeur EN PLACE (ou la valeur par défaut du code) : on voit (œil) et on corrige directement.
  const [initial, setInitial] = useState<Record<string, string>>({})
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const confirm = useConfirm()
  const names = service?.secrets.map((s) => s.name).join(',') ?? ''

  useEffect(() => {
    setValues({}); setInitial({}); setError(null); setOrigin(window.location.origin)
    if (!names) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/admin/secrets?values=${encodeURIComponent(names)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) { setInitial(data.values); setValues(data.values) }
        else setError(data.message || 'Valeurs actuelles illisibles.')
      })
      .catch(() => !cancelled && setError('Valeurs actuelles illisibles : vérifie ta connexion.'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [service?.id, names])

  if (!service) return null

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    // Seuls les champs modifiés partent ; un champ vidé retire la valeur posée dans l'admin.
    const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => v.trim() !== (initial[k] ?? '').trim() && v.trim()))
    const cleared = service.secrets.filter((s) => s.source === 'admin' && !(values[s.name] ?? '').trim() && (initial[s.name] ?? '').trim())
    if (!Object.keys(changed).length && !cleared.length) return setError('Aucune modification à enregistrer.')
    setBusy(true)
    setError(null)
    try {
      let data: { success: boolean; message?: string; secrets?: Secret[] } = { success: true }
      if (Object.keys(changed).length) {
        const res = await fetch('/api/admin/secrets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: changed }) })
        data = await res.json()
        if (!data.success) return setError(data.message ?? 'Enregistrement impossible.')
      }
      for (const s of cleared) {
        const res = await fetch(`/api/admin/secrets?name=${encodeURIComponent(s.name)}`, { method: 'DELETE' })
        data = await res.json()
        if (!data.success) return setError(data.message ?? 'Suppression impossible.')
      }
      onSaved(data.secrets ?? [], `${service.name} : enregistré et actif tout de suite.`)
    } catch {
      setError('Enregistrement impossible : vérifie ta connexion et réessaie.')
    } finally {
      setBusy(false)
    }
  }

  const reset = async (secret: Secret) => {
    if (!(await confirm({ title: `Retirer ${secret.label.toLowerCase()} ?`, message: 'Le site reprendra la valeur du serveur, s’il y en a une.', confirmLabel: 'Retirer', danger: true }))) return
    const res = await fetch(`/api/admin/secrets?name=${encodeURIComponent(secret.name)}`, { method: 'DELETE' })
    const data = await res.json()
    if (!data.success) return setError(data.message)
    onSaved(data.secrets, `${secret.label} retirée.`)
  }

  return (
    <Modal open onClose={onClose} title={service.name} subtitle={service.description} icon={<ServiceLogo service={service} />}
      footer={<>
        <span className="mr-auto text-xs text-gray-500">Chiffré dans la base, actif tout de suite.</span>
        <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
        <Button type="submit" form="service-keys-form" disabled={busy || loading}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </>}>
      {service.where && (
        <p className="mb-4 text-sm text-gray-600">
          Où la trouver : <a href={service.where.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline-offset-2 hover:underline">{service.where.label}</a>
        </p>
      )}
      {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <form id="service-keys-form" onSubmit={save} className="space-y-4">
        {service.secrets.map((s) => {
          const filled = s.source !== 'missing'
          return (
            <div key={s.name}>
              <label htmlFor={`cle-${s.name}`} className="mb-1 flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-gray-800">
                {s.label}
                {s.source === 'server' && <span className="text-xs font-normal text-gray-500">valeur du serveur</span>}
                {!filled && s.defaultValue && <span className="text-xs font-normal text-gray-500">valeur par défaut</span>}
                {s.unreadable && <span className="text-xs font-normal text-red-700">à ressaisir</span>}
                {!s.optional && !filled && <span className="text-xs font-normal text-gray-400">{s.required ? 'indispensable' : ''}</span>}
              </label>
              <div className="flex gap-2">
                {(() => {
                  const props = {
                    id: `cle-${s.name}`, autoComplete: s.secret ? 'new-password' : 'off', spellCheck: false, value: values[s.name] ?? '',
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [s.name]: e.target.value }),
                    placeholder: loading ? 'Chargement…' : `Colle ${s.label.toLowerCase()}`,
                    disabled: loading,
                  }
                  // Secret masqué (œil pour l'afficher), valeur non secrète en clair.
                  return s.secret
                    ? <div className="min-w-0 flex-1"><PasswordInput {...props} className="py-2" /></div>
                    : <Input {...props} className="py-2" />
                })()}
                {s.generate && (
                  <Button type="button" variant="secondary" onClick={() => setValues({ ...values, [s.name]: randomSecret() })}>Générer</Button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">{s.help}</p>
              {s.oauthCallback && (
                <p className="mt-1 text-xs text-gray-500">Adresse de redirection à déclarer chez Google : <code className="select-all">{(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')}/auth/v1/callback</code></p>
              )}
              {s.webhookPath && origin && (
                <p className="mt-1 text-xs text-gray-500">Adresse du webhook à déclarer : <code className="select-all">{origin}{s.webhookPath}</code></p>
              )}
              <p className="mt-1 text-[11px] text-gray-400">
                <code>{s.name}</code>
                {s.source === 'admin' && <> · <button type="button" onClick={() => reset(s)} className="underline hover:text-gray-700">retirer</button></>}
              </p>
            </div>
          )
        })}
      </form>
    </Modal>
  )
}
