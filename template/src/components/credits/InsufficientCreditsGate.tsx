'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Fenêtre « crédits insuffisants » pour TOUT le site connecté, sans rien câbler page par page :
// ErrorReporter repère toute réponse /api avec error_code « insufficient_credits » et émet cet événement.
// Sans ce relais, le client ne voit qu'un message d'erreur discret et n'arrive jamais jusqu'à l'achat.
export const INSUFFICIENT_CREDITS_EVENT = 'insufficient-credits'

export function InsufficientCreditsGate() {
  const [message, setMessage] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onEvent = (event: Event) => {
      setMessage((event as CustomEvent<string | null>).detail ?? null)
      setOpen(true)
    }
    window.addEventListener(INSUFFICIENT_CREDITS_EVENT, onEvent)
    return () => window.removeEventListener(INSUFFICIENT_CREDITS_EVENT, onEvent)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="credits-title" className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="credits-title" className="text-base font-bold text-gray-900">Crédits insuffisants</h2>
        {message && <p className="mt-1.5 text-sm text-gray-600">{message}</p>}
        <div className="mt-5 flex flex-col gap-2">
          <Link href="/credits" onClick={() => setOpen(false)} className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-hover">
            Recharger mes crédits
          </Link>
          <Button variant="ghost" onClick={() => setOpen(false)}>Plus tard</Button>
        </div>
      </div>
    </div>
  )
}
