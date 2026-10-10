'use client'

import { site } from '@/config/site'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone, MessagesSquare, Plus, Trash2 } from 'lucide-react'
import { clsx } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { RadioCard } from '@/components/ui/choice'
import { useConfirm } from '@/components/ui/dialog'
import type { Channel } from '@/lib/community/feed'

const when = (iso: string) => {
  const d = new Date(iso), now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Colonne de gauche : la communauté et ses groupes (Annonces en premier), comme une communauté WhatsApp. */
export function ChannelList({ channels, active, isAdmin }: { channels: Channel[]; active: string | null; isAdmin: boolean }) {
  const router = useRouter()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<'discussion' | 'annonces'>('discussion')
  const [error, setError] = useState<string | null>(null)
  const annonces = channels.filter((c) => c.mode === 'annonces')
  const groups = channels.filter((c) => c.mode === 'discussion')

  const create = async () => {
    setError(null)
    const d = await fetch('/api/admin/community/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, mode }) }).then((r) => r.json()).catch(() => ({ success: false }))
    if (!d.success) return setError(d.message || 'Groupe non créé.')
    setOpen(false); setName(''); setDescription('')
    router.push(`/communaute?g=${d.slug}`); router.refresh()
  }
  const remove = async (c: Channel) => {
    if (!(await confirm({ title: `Supprimer « ${c.name} » ?`, message: 'Tous ses messages et fichiers seront supprimés pour tout le monde.', confirmLabel: 'Supprimer le groupe', danger: true }))) return
    await fetch('/api/admin/community/channels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delete: c.slug }) })
    router.push('/communaute'); router.refresh()
  }

  const Row = ({ c }: { c: Channel }) => (
    <div className="group relative">
      <Link href={`/communaute?g=${c.slug}`} className={clsx('flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors', active === c.slug ? 'bg-gray-100' : 'hover:bg-gray-100')}>
        <span className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-full', c.mode === 'annonces' ? 'bg-brand text-white' : 'bg-gray-100 text-brand')}>
          {c.mode === 'annonces' ? <Megaphone className="h-5 w-5" /> : <MessagesSquare className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-medium">{c.name}</span>
            {c.last && <span className="ml-auto shrink-0 text-xs text-gray-500">{when(c.last.at)}</span>}
          </span>
          <span className="block truncate text-sm text-gray-500">{c.last ? `${c.mode === 'discussion' && c.last.author ? `${c.last.author} : ` : ''}${c.last.text}` : c.description}</span>
        </span>
      </Link>
      {isAdmin && !['annonces', 'discussion'].includes(c.slug) && (
        <button type="button" onClick={() => remove(c)} className="absolute right-2 top-2 hidden rounded-full bg-surface p-1.5 text-gray-500 shadow hover:text-red-600 group-hover:block" aria-label="Supprimer le groupe"><Trash2 className="h-4 w-4" /></button>
      )}
    </div>
  )

  return (
    <aside className="flex h-full flex-col border-r border-gray-200">
      <header className="flex items-center gap-3 border-b border-gray-200 px-4 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.logo} alt="" className="h-12 w-12 rounded-2xl object-cover" />
        <div>
          <p className="text-lg font-medium">{site.name}</p>
          <p className="text-xs text-gray-500">Communauté</p>
        </div>
      </header>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {annonces.map((c) => <Row key={c.id} c={c} />)}
        {groups.length > 0 && <p className="px-3 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-gray-500">Groupes</p>}
        {groups.map((c) => <Row key={c.id} c={c} />)}
      </nav>
      {isAdmin && (
        <div className="border-t border-gray-200 p-3">
          <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-full bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand-hover"><Plus className="h-4 w-4" /> Ajouter un groupe</button>
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau groupe" subtitle="Tous les membres de la communauté y auront accès."
        footer={<button type="button" disabled={!name.trim()} onClick={create} className="rounded-full bg-brand px-6 py-2.5 font-medium text-white disabled:opacity-50">Créer le groupe</button>}>
        <div className="space-y-3">
          <input className="w-full rounded-xl border border-gray-200 bg-surface px-3 py-2 outline-none focus:border-brand" placeholder="Nom du groupe, ex. Entraide débutants" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <input className="w-full rounded-xl border border-gray-200 bg-surface px-3 py-2 outline-none focus:border-brand" placeholder="Description (facultatif)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
          <RadioCard checked={mode === 'discussion'} onSelect={() => setMode('discussion')} label="Discussion" description="Tous les membres écrivent et s’entraident." />
          <RadioCard checked={mode === 'annonces'} onSelect={() => setMode('annonces')} label="Annonces" description="Toi seul écris ; les membres lisent et réagissent." />
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </Modal>
    </aside>
  )
}
