'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { clsx } from '@/lib/utils'
import { ProBadge } from '@/components/ProBadge'

// Rond de profil en haut à droite : un clic ouvre le compte, l'administration et la déconnexion.
export function ProfileMenu({ name, email, avatarUrl, isAdmin, pro = false, logout }: {
  name: string
  email: string
  avatarUrl: string | null
  isAdmin: boolean
  pro?: boolean
  logout: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label = name || email
  const initials = (name || email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
  const avatar = (size: string) => avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className={clsx(size, 'rounded-full object-cover')} />
  ) : (
    <span aria-hidden className={clsx(size, 'grid place-items-center rounded-full bg-brand text-sm font-semibold text-white')}>{initials}</span>
  )

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Mon profil"
        className={clsx('rounded-full ring-2 transition-shadow', open ? 'ring-brand' : 'ring-gray-200 hover:ring-brand')}
      >
        {avatar('h-10 w-10')}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-surface shadow-2xl">
          <div className="flex items-center gap-3 border-b border-gray-200 p-4">
            {avatar('h-12 w-12')}
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate font-medium text-gray-900">
                <span className="truncate">{label}</span>
                {pro && <ProBadge size="sm" className="shrink-0" />}
              </p>
              {name && <p className="truncate text-sm text-gray-500">{email}</p>}
            </div>
          </div>
          <nav className="p-2 text-sm">
            <MenuLink href="/dashboard" onClick={() => setOpen(false)}>Espace client</MenuLink>
            <MenuLink href="/mes-achats" onClick={() => setOpen(false)}>Formations</MenuLink>
            <MenuLink href="/settings" onClick={() => setOpen(false)}>Mon compte</MenuLink>
            <MenuLink href="/billing-history" onClick={() => setOpen(false)}>Factures</MenuLink>
            {isAdmin && <MenuLink href="/admin" onClick={() => setOpen(false)}>Administration</MenuLink>}
          </nav>
          <div className="border-t border-gray-200 p-2">{logout}</div>
        </div>
      )}
    </div>
  )
}

function MenuLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} role="menuitem" onClick={onClick} className="block rounded-xl px-3 py-2.5 text-gray-700 hover:bg-gray-100 hover:text-gray-900">
      {children}
    </Link>
  )
}
