'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Download, Trash2 } from 'lucide-react'
import { clsx } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/components/ui/dialog'
import { Modal } from '@/components/ui/modal'

const field = 'w-full rounded-xl border border-gray-200 bg-surface px-4 py-2.5 outline-none focus:border-brand'

/** Photo de profil : envoyer une image (3 Mo), ou revenir à la photo Google / aux initiales. */
export function AvatarEditor({ url, initials }: { url: string | null; initials: string }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pick = async (file?: File) => {
    if (!file) return
    setBusy(true); setError(null)
    try {
      const signed = await fetch('/api/account/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: file.type, size: file.size }) }).then((r) => r.json())
      if (!signed.success) throw new Error(signed.message || 'Envoi impossible.')
      const upUrl = signed.signedUrl.startsWith('http') ? signed.signedUrl : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${signed.signedUrl}`
      const form = new FormData(); form.append('cacheControl', '3600'); form.append('', file)
      const res = await fetch(upUrl, { method: 'PUT', body: form, headers: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } : {} })
      if (!res.ok) throw new Error('Envoi refusé.')
      const done = await fetch('/api/account/avatar', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: signed.path }) }).then((r) => r.json())
      if (!done.success) throw new Error('Photo non enregistrée.')
      router.refresh()
    } catch (e) { setError((e as Error).message) }
    setBusy(false)
    if (input.current) input.current.value = ''
  }
  const reset = async () => { setBusy(true); await fetch('/api/account/avatar', { method: 'DELETE' }); setBusy(false); router.refresh() }
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="group relative h-28 w-28 overflow-hidden rounded-full ring-4 ring-brand/20" aria-label="Changer ma photo">
        {url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          : <span className="grid h-full w-full place-items-center bg-brand text-3xl font-semibold text-white">{initials}</span>}
        <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100"><Camera className="h-7 w-7" /></span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <div className="flex gap-3 text-xs">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="text-brand underline">{busy ? 'Envoi…' : 'Changer la photo'}</button>
        {url && <button type="button" onClick={reset} disabled={busy} className="text-gray-500 underline">Retirer</button>}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}

type Identity = { full_name: string; username: string; bio: string; phone: string; country: string }

export function IdentityForm({ initial }: { initial: Identity }) {
  const router = useRouter()
  const [f, setF] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Identity, v: string) => setF((x) => ({ ...x, [k]: v }))
  const save = async () => {
    setBusy(true); setMsg(null)
    const d = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }).then((r) => r.json()).catch(() => ({ success: false }))
    setBusy(false)
    setMsg({ ok: !!d.success, text: d.message || (d.success ? 'Enregistré.' : 'Erreur.') })
    if (d.success) router.refresh()
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm"><span className="mb-1 block text-gray-500">Nom complet</span><input className={field} value={f.full_name} onChange={(e) => set('full_name', e.target.value)} maxLength={120} autoComplete="name" /></label>
      <label className="text-sm"><span className="mb-1 block text-gray-500">Pseudo (affiché dans la communauté)</span>
        <span className="flex items-center rounded-xl border border-gray-200 bg-surface pl-4 focus-within:border-brand"><span className="text-gray-500">@</span>
          <input className="w-full bg-transparent px-1 py-2.5 outline-none" value={f.username} onChange={(e) => set('username', e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} maxLength={30} placeholder="ton.pseudo" /></span></label>
      <label className="text-sm sm:col-span-2"><span className="mb-1 block text-gray-500">Présentation (200 caractères)</span><textarea className={field} rows={2} value={f.bio} onChange={(e) => set('bio', e.target.value)} maxLength={200} placeholder="Ex. Créateur YouTube faceless, je lance mon SaaS." /></label>
      <label className="text-sm"><span className="mb-1 block text-gray-500">WhatsApp (avec l’indicatif)</span><input className={field} value={f.phone} onChange={(e) => set('phone', e.target.value)} maxLength={30} autoComplete="tel" placeholder="+237 6…" /></label>
      <label className="text-sm"><span className="mb-1 block text-gray-500">Pays</span><input className={field} value={f.country} onChange={(e) => set('country', e.target.value)} maxLength={60} autoComplete="country-name" /></label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="button" onClick={save} disabled={busy} className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60">{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        {msg && <p className={clsx('text-sm', msg.ok ? 'text-green-700' : 'text-red-700')}>{msg.text}</p>}
      </div>
    </div>
  )
}

/** Connexion avec Google : liée ou non ; lier = se connecter une fois avec le même e-mail Google. */
export function GoogleConnection({ linked, available, canUnlink }: { linked: boolean; available: boolean; canUnlink: boolean }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [msg, setMsg] = useState<string | null>(null)
  const link = async () => {
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=/settings`
    const { error } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo } })
    if (error) {
      const r = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
      if (r.error) setMsg('Connexion Google indisponible pour le moment.')
    }
  }
  const unlink = async () => {
    if (!(await confirm({ title: 'Délier ton compte Google ?', message: 'Tu te connecteras ensuite avec ton e-mail (lien ou mot de passe).', confirmLabel: 'Délier', danger: true }))) return
    const supabase = createClient()
    const { data } = await supabase.auth.getUserIdentities()
    const google = data?.identities.find((i) => i.provider === 'google')
    if (!google) return
    const { error } = await supabase.auth.unlinkIdentity(google)
    setMsg(error ? 'Impossible de délier pour l’instant : écris au support.' : 'Compte Google délié.')
    router.refresh()
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logos/services/google.svg" alt="" className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Google</p>
        <p className="text-sm text-gray-500">{linked ? 'Lié : tu peux te connecter en un clic avec Google.' : available ? 'Non lié : connecte-toi en un clic avec ton compte Google.' : 'La connexion avec Google n’est pas encore ouverte sur le site.'}</p>
        {msg && <p className="text-sm text-gray-700">{msg}</p>}
      </div>
      {linked ? (canUnlink && <button type="button" onClick={unlink} className="rounded-full border border-gray-300 px-5 py-2 text-sm hover:border-gray-400">Délier</button>)
        : available && <button type="button" onClick={link} className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover">Lier mon compte Google</button>}
    </div>
  )
}

/** Mes données : les télécharger (fichier), ou supprimer le compte (confirmation écrite « SUPPRIMER »). */
export function DataControls({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [error, setError] = useState<string | null>(null)
  const remove = async () => {
    setError(null)
    const d = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: word }) }).then((r) => r.json()).catch(() => ({ success: false }))
    if (!d.success) return setError(d.message || 'Suppression impossible.')
    window.location.href = '/'
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1"><p className="font-medium">Télécharger mes données</p><p className="text-sm text-gray-500">Profil, achats, progression, demandes et messages, dans un fichier.</p></div>
        <a href="/api/account" className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2 text-sm hover:border-brand"><Download className="h-4 w-4" /> Télécharger</a>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 pt-4">
        <div className="min-w-0 flex-1"><p className="font-medium text-red-700">Supprimer mon compte</p><p className="text-sm text-gray-500">Définitif : tu perds l’accès à tes formations. Tes factures restent pour la comptabilité, sans lien avec toi.</p></div>
        <button type="button" disabled={isAdmin} onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-red-200 px-5 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Supprimer</button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Supprimer ton compte ?" subtitle="Cette action est définitive."
        footer={<button type="button" disabled={word !== 'SUPPRIMER'} onClick={remove} className="rounded-full bg-red-600 px-6 py-2.5 font-medium text-white disabled:opacity-50">Supprimer définitivement</button>}>
        <p className="mb-3 text-sm text-gray-600">Écris <strong>SUPPRIMER</strong> pour confirmer.</p>
        <input className={field} value={word} onChange={(e) => setWord(e.target.value)} autoFocus />
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </Modal>
    </div>
  )
}
