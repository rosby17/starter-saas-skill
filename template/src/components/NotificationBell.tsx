'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { clsx } from '@/lib/utils'

type Notif = { id: string; title: string; body: string | null; url: string | null; created_at: string; read_at: string | null }

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `il y a ${Math.max(1, m)} min`
  if (m < 1440) return `il y a ${Math.round(m / 60)} h`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

// Cloche des nouveautés (nouveau module, nouvelle leçon) en haut de l'espace client.
export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const unread = items.filter((n) => !n.read_at).length

  useEffect(() => {
    fetch('/api/notifications', { cache: 'no-store' }).then((r) => r.json()).then((d) => d.success && setItems(d.notifications)).catch(() => {})
  }, [])
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && unread) {
      void fetch('/api/notifications', { method: 'POST' })
      setTimeout(() => setItems((all) => all.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))), 1500)
    }
  }

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={toggle} aria-label={unread ? `${unread} nouveauté${unread > 1 ? 's' : ''}` : 'Nouveautés'} aria-expanded={open}
        className={clsx('relative grid h-10 w-10 place-items-center rounded-full border transition-colors', open ? 'border-brand text-gray-900' : 'border-gray-200 text-gray-600 hover:text-gray-900')}>
        <Bell className="h-5 w-5" strokeWidth={1.8} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-semibold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-surface shadow-2xl">
          <p className="border-b border-gray-200 px-4 py-3 font-medium">Nouveautés</p>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">Rien de nouveau pour l’instant. Chaque nouveau module de tes formations s’affichera ici.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-200 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.url || '/mes-achats'} onClick={() => setOpen(false)} className={clsx('flex gap-3 px-4 py-3 hover:bg-gray-100', !n.read_at && 'bg-brand/5')}>
                    <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-brand')} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{n.title}</span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-sm text-gray-600">{n.body}</span>}
                      <span className="mt-1 block text-xs text-gray-500">{ago(n.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
