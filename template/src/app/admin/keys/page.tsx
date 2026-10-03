'use client'

import { useEffect, useState } from 'react'
import { useConfirm } from '@/components/ui/dialog'

type Secret = {
  name: string
  label: string
  group: string
  help: string
  secret: boolean
  generate?: boolean
  webhookPath?: string
  source: 'admin' | 'server' | 'missing'
  required: boolean
  unreadable: boolean
  preview: string | null
}

const randomSecret = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Clés et intégrations : l'administrateur pose ou remplace chaque clé en un clic, sans toucher au serveur.
// La clé est active dès l'enregistrement (pas de redéploiement).
export default function KeysPage() {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [origin, setOrigin] = useState('')
  const confirm = useConfirm()

  const load = async () => {
    const res = await fetch('/api/admin/secrets')
    const data = await res.json()
    if (data.success) setSecrets(data.secrets)
    else setMessage({ ok: false, text: data.message })
  }
  useEffect(() => {
    setOrigin(window.location.origin)
    load().then(() => {
      const focus = new URLSearchParams(window.location.search).get('focus')
      if (focus) setEditing(focus)
    })
  }, [])

  const open = (name: string) => { setEditing(name); setValue(''); setMessage(null) }

  const save = async (name: string) => {
    setBusy(true)
    const res = await fetch('/api/admin/secrets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value }),
    })
    const data = await res.json()
    setBusy(false)
    if (!data.success) return setMessage({ ok: false, text: data.message })
    setSecrets(data.secrets)
    setEditing(null)
    setValue('')
    setMessage({ ok: true, text: `${name} enregistrée et active.` })
  }

  const reset = async (name: string) => {
    if (!(await confirm({ title: `Effacer ${name} ?`, message: "Le site reprendra la valeur du serveur, s'il y en a une.", confirmLabel: 'Effacer', danger: true }))) return
    const res = await fetch(`/api/admin/secrets?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
    const data = await res.json()
    if (!data.success) return setMessage({ ok: false, text: data.message })
    setSecrets(data.secrets)
    setMessage({ ok: true, text: `${name} effacée.` })
  }

  const missing = secrets.filter((s) => s.required && s.source === 'missing')
  const groups = [...new Set(secrets.map((s) => s.group))]

  return (
    <main className="max-w-3xl p-8">
      <h1 className="mb-2 text-2xl font-bold">Clés et intégrations</h1>
      <p className="mb-6 text-sm text-gray-500">
        Colle ici les clés de tes services. Elles sont chiffrées, jamais réaffichées en entier, et actives dès l&apos;enregistrement.
        Une clé saisie ici remplace celle du serveur.
      </p>

      {missing.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {missing.length} clé{missing.length > 1 ? 's' : ''} manquante{missing.length > 1 ? 's' : ''} pour ce qui est activé : {missing.map((s) => s.name).join(', ')}.
        </div>
      )}
      {message && (
        <div className={`mb-4 rounded-xl border p-3 text-sm ${message.ok ? 'border-green-100 bg-green-50 text-green-700' : 'border-red-100 bg-red-50 text-red-700'}`}>{message.text}</div>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group} className="rounded-2xl border border-gray-200 p-5">
            <h2 className="mb-3 font-semibold">{group}</h2>
            <div className="space-y-3">
              {secrets.filter((s) => s.group === group).map((s) => (
                <div key={s.name} id={s.name} className="rounded-lg border border-gray-200 px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.label}</span>
                    <code className="text-xs text-gray-400">{s.name}</code>
                    <span className="ml-auto flex items-center gap-2">
                      {s.unreadable && <span className="text-xs text-red-700">à ressaisir</span>}
                      {s.source === 'missing' ? (
                        <span className={`text-xs ${s.required ? 'text-amber-700' : 'text-gray-400'}`}>{s.required ? 'manquante' : 'non renseignée'}</span>
                      ) : (
                        <span className="text-xs text-green-700">{s.source === 'admin' ? 'renseignée ici' : 'sur le serveur'} · {s.preview}</span>
                      )}
                      <button type="button" onClick={() => open(s.name)} className={`rounded-lg px-3 py-1 text-xs font-medium ${s.source === 'missing' ? 'bg-brand text-white' : 'border border-gray-200'}`}>
                        {s.source === 'missing' ? 'Renseigner' : 'Remplacer'}
                      </button>
                      {s.source === 'admin' && (
                        <button type="button" onClick={() => reset(s.name)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500">Effacer</button>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{s.help}</p>
                  {s.webhookPath && origin && (
                    <p className="mt-1 text-xs text-gray-500">Adresse du webhook à déclarer : <code className="select-all">{origin}{s.webhookPath}</code></p>
                  )}
                  {editing === s.name && (
                    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); save(s.name) }}>
                      <input
                        autoFocus
                        type={s.secret && !s.generate ? 'password' : 'text'}
                        autoComplete="off"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={`Colle ${s.label.toLowerCase()}`}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      {s.generate && (
                        <button type="button" onClick={() => setValue(randomSecret())} className="rounded-lg border border-gray-200 px-3 py-2 text-xs">Générer</button>
                      )}
                      <button type="submit" disabled={busy || !value.trim()} className="rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white disabled:opacity-40">Enregistrer</button>
                      <button type="button" onClick={() => setEditing(null)} className="px-2 text-xs text-gray-500">Annuler</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
