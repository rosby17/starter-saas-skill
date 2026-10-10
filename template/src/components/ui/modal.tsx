'use client'

import { useEffect, useId, useRef } from 'react'
import { clsx } from '@/lib/utils'

// Fenêtre aux couleurs du site (la balise <dialog> du navigateur est INTERDITE).
// Fermée par Échap, par un clic sur le voile ou par le bouton ×. Le premier champ reçoit le focus.
export function Modal({ open, onClose, title, subtitle, icon, children, footer, className }: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // onClose est souvent une fonction recréée à chaque rendu : on garde la dernière sans relancer l'effet
  // (sinon le focus sauterait sur le premier champ à chaque frappe).
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    const previous = document.activeElement as HTMLElement | null
    const first = box.current?.querySelector<HTMLElement>('input, textarea, button:not([data-modal-close])')
    first?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4" onMouseDown={onClose}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(e) => e.stopPropagation()}
        className={clsx('w-full max-w-lg rounded-2xl border border-gray-200 bg-surface p-6 shadow-xl', className)}>
        <div className="flex items-start gap-3">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>}
          </div>
          <button type="button" data-modal-close onClick={onClose} aria-label="Fermer"
            className="-mr-2 -mt-2 grid h-9 w-9 place-items-center rounded-lg text-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700">×</button>
        </div>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
