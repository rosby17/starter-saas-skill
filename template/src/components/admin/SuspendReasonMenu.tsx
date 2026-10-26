'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Ban } from 'lucide-react'
import { SUSPENSION_REASONS, type SuspensionReasonCode } from '@/lib/admin/suspension-reasons'

const PANEL_WIDTH = 320
const PANEL_HEIGHT = 300

// Bouton « Suspendre » qui ouvre la liste des motifs : un clic sur un motif déclenche l'action, et l'e-mail préétabli
// de ce motif part au client (rien à rédiger). Rendu par-dessus la page (portail) et recalé dans l'écran : dans un
// tableau qui défile ou une carte étroite, un menu positionné dedans était coupé. Fermé au clic dehors ou par Échap.
export function SuspendReasonMenu({ disabled, className, onPick, children }: {
  disabled?: boolean
  className: string
  onPick: (code: SuspensionReasonCode) => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<{ top: number; left: number; up: boolean } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const rect = button.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16)
    const up = window.innerHeight - rect.bottom < PANEL_HEIGHT && rect.top > PANEL_HEIGHT
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
    setBox({ top: up ? rect.top - 6 : rect.bottom + 6, left, up })
  }, [])

  useLayoutEffect(() => { if (open) place() }, [open, place])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      const t = e.target as Node
      if (button.current?.contains(t) || panel.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  return (
    <>
      <button ref={button} type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={className}>
        {children}
      </button>
      {open && box && createPortal(
        <div ref={panel} role="menu"
          style={{ position: 'fixed', top: box.top, left: box.left, width: `min(${PANEL_WIDTH}px, calc(100vw - 16px))`, transform: box.up ? 'translateY(-100%)' : undefined }}
          className="z-[60] rounded-xl border border-gray-200 bg-surface p-1.5 text-left shadow-xl">
          <div className="border-b border-gray-200 px-3 pb-2 pt-1.5">
            <p className="text-sm font-semibold">Motif de la suspension</p>
            <p className="mt-0.5 text-xs leading-snug text-gray-500">Le client reçoit l’e-mail prévu pour ce motif (modèle « Compte suspendu », Administration › E-mails).</p>
          </div>
          <div className="pt-1">
            {SUSPENSION_REASONS.map((r) => (
              <button key={r.code} type="button" role="menuitem" onClick={() => { setOpen(false); onPick(r.code) }}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm leading-snug text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700">
                <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
