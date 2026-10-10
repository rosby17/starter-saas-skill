'use client'

import { useEffect, useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'rf_install_dismissed'
const DISMISS_DAYS = 10

/**
 * Invitation à installer l'application sur le téléphone (espace élève).
 * Android / Chrome : bouton « Installer » natif. iPhone : les 3 gestes « Partager → Sur l'écran d'accueil ».
 * Jamais sur ordinateur ni dans l'appli déjà installée ; « Plus tard » la cache 10 jours.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [visible, setVisible] = useState(false)
  const [steps, setSteps] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
    const mobile = window.matchMedia('(max-width: 768px)').matches
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (standalone || !mobile || Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)
    const t = isIos ? setTimeout(() => { setIos(true); setVisible(true) }, 3000) : undefined
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); setVisible(true) }
    const onInstalled = () => setVisible(false)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      if (t) clearTimeout(t)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setVisible(false) }
  const install = async () => {
    if (ios) return setSteps(true)
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') setVisible(false)
    setDeferred(null)
  }

  if (!visible) return null
  return (
    <div className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50" style={{ animation: 'courseRise 0.4s ease-out both' }} role="dialog" aria-label="Installer l’application">
      <div className="rounded-3xl border border-gray-200 bg-surface p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pwa/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Installe l’application</p>
            <p className="mt-0.5 text-sm text-gray-600">Tes formations sur ton écran d’accueil : tu les ouvres en un geste, comme une appli.</p>
          </div>
          <button type="button" onClick={dismiss} aria-label="Plus tard" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        {steps ? (
          <ol className="mt-4 space-y-2 text-sm">
            {[
              <>Touche <Share className="inline h-4 w-4 -mt-0.5 text-blue-700" /> <b>Partager</b> en bas de l’écran</>,
              <>Choisis <SquarePlus className="inline h-4 w-4 -mt-0.5" /> <b>Sur l’écran d’accueil</b></>,
              <>Touche <b>Ajouter</b> : c’est fait</>,
            ].map((t, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl bg-gray-100 px-3 py-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-medium text-white">{i + 1}</span>
                <span className="flex-1">{t}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={install} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3 font-medium text-white hover:bg-brand-hover">
              <Download className="h-4 w-4" /> Installer
            </button>
            <button type="button" onClick={dismiss} className="rounded-2xl px-4 text-sm text-gray-600 hover:bg-gray-100">Plus tard</button>
          </div>
        )}
      </div>
    </div>
  )
}
