'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCookieConsent, setCookieConsent, onOpenCookieConsentSettings } from '@/lib/cookie-consent'

// Montée à la racine (app/layout.tsx). Invisible tant que le consentement n'est pas lu côté navigateur (pas de flash au rendu serveur).
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(getCookieConsent() === null)
    return onOpenCookieConsentSettings(() => setVisible(true))
  }, [])

  if (!visible) return null
  const choose = (choice: 'accepted' | 'rejected') => { setCookieConsent(choice); setVisible(false) }

  return (
    <div role="dialog" aria-live="polite" aria-label="Cookies" className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-4 sm:justify-end sm:px-6 sm:pb-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 text-gray-700 shadow-2xl">
        <p className="text-[13px] leading-relaxed">
          Nous utilisons des cookies de mesure d’audience uniquement avec votre accord.{' '}
          <Link href="/privacy" className="font-semibold text-brand underline underline-offset-2">En savoir plus</Link>
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => choose('rejected')} className="rounded-full border border-gray-300 px-4 py-2 text-[13px] font-semibold hover:bg-gray-50">Refuser</button>
          <button type="button" onClick={() => choose('accepted')} className="rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover">Accepter</button>
        </div>
      </div>
    </div>
  )
}
