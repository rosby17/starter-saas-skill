'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { clsx } from '@/lib/utils'
import { ThemeSwitch } from '@/components/ThemeSwitch'
import { LayoutDashboard } from 'lucide-react'

const SETTINGS = [
  { href: '/admin/payment-providers', label: 'Moyens de paiement', text: 'Mobile Money, Wave, carte, PayPal, crypto' },
  { href: '/admin/keys', label: 'Clés et intégrations', text: 'E-mails, paiements, tâches automatiques' },
  { href: '/admin/deploy', label: 'Mise en ligne', text: 'Serveur, base de données, déploiement' },
  { href: '/admin/emails', label: 'E-mails', text: 'Journal des envois, exemples de chaque e-mail' },
  { href: '/admin/sante', label: 'Santé du site', text: 'Erreurs des clients : causes et solutions' },
  { href: '/admin/server', label: 'Ressources serveur', text: 'Processeur, mémoire, disque' },
  { href: '/admin/maintenance', label: 'Maintenance', text: 'Couper le site le temps d’une intervention' },
]

function useOutside(open: boolean, close: () => void) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open, close])
  return box
}

// Bandeau du haut de l'administration : thème, Paramètres (réglages rares), profil (espace client, déconnexion).
export function AdminTopBar({ email, logout }: { email: string; logout: React.ReactNode }) {
  const [menu, setMenu] = useState<'settings' | 'profile' | null>(null)
  const close = () => setMenu(null)
  const box = useOutside(menu !== null, close)
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-3 border-b border-gray-200 bg-gray-50/80 px-4 backdrop-blur md:h-20 md:px-8">
      <ThemeSwitch />
      <Link href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-full border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:border-brand hover:text-gray-900">
        <LayoutDashboard className="h-4 w-4" strokeWidth={1.8} /><span className="hidden sm:inline">Espace client</span>
      </Link>
      <div ref={box} className="relative flex items-center gap-3">
        <button type="button" onClick={() => setMenu(menu === 'settings' ? null : 'settings')} aria-expanded={menu === 'settings'} aria-haspopup="menu" aria-label="Paramètres"
          className={clsx('grid h-10 w-10 place-items-center rounded-full border transition-colors', menu === 'settings' ? 'border-brand text-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900')}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
        <button type="button" onClick={() => setMenu(menu === 'profile' ? null : 'profile')} aria-expanded={menu === 'profile'} aria-haspopup="menu" aria-label="Mon profil"
          className={clsx('grid h-10 w-10 place-items-center rounded-full bg-brand text-sm font-semibold text-white ring-2 transition-shadow', menu === 'profile' ? 'ring-brand' : 'ring-gray-200 hover:ring-brand')}>
          {initials}
        </button>

        {menu === 'settings' && (
          <div role="menu" className="absolute right-12 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-surface p-2 shadow-2xl">
            <p className="px-3 pb-1 pt-2 text-xs uppercase tracking-[0.16em] text-gray-500">Paramètres</p>
            {SETTINGS.map((s) => (
              <Link key={s.href} href={s.href} role="menuitem" onClick={close} className="block rounded-xl px-3 py-2.5 hover:bg-gray-100">
                <span className="block text-sm text-gray-900">{s.label}</span>
                <span className="block text-xs text-gray-500">{s.text}</span>
              </Link>
            ))}
          </div>
        )}
        {menu === 'profile' && (
          <div role="menu" className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-surface shadow-2xl">
            <div className="border-b border-gray-200 p-4">
              <p className="truncate font-medium text-gray-900">{email}</p>
              <p className="text-xs text-gray-500">Administrateur</p>
            </div>
            <nav className="p-2 text-sm">
              <Link href="/dashboard" role="menuitem" onClick={close} className="block rounded-xl px-3 py-2.5 text-gray-700 hover:bg-gray-100 hover:text-gray-900">Espace client</Link>
              <Link href="/settings" role="menuitem" onClick={close} className="block rounded-xl px-3 py-2.5 text-gray-700 hover:bg-gray-100 hover:text-gray-900">Mon compte</Link>
            </nav>
            <div className="border-t border-gray-200 p-2">{logout}</div>
          </div>
        )}
      </div>
    </header>
  )
}
