'use client'

import { openCookieConsentSettings } from '@/lib/cookie-consent'

/** Rouvre la bannière de consentement. À mettre dans le pied de page (obligation : pouvoir changer d'avis). */
export function CookieSettingsLink({ className }: { className?: string }) {
  return <button type="button" onClick={openCookieConsentSettings} className={className}>Gérer les cookies</button>
}
