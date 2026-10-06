// Consentement aux cookies NON essentiels (statistiques, publicité).
// RGPD / ePrivacy : rien ne doit être déposé avant un choix explicite. Le charger APRÈS « accepté » seulement :
//   if (getCookieConsent() === 'accepted') loadAnalytics()   // et écouter onCookieConsentChange
// Le choix lui-même (« accepted » / « rejected », aucun identifiant) est un cookie strictement nécessaire.
export type CookieConsentChoice = 'accepted' | 'rejected'

const KEY = 'cookie_consent'
const CHANGED = 'cookie-consent-changed'
const OPEN = 'cookie-consent-open-settings'
const MAX_AGE = 365 * 24 * 60 * 60 // 12 mois, puis on redemande (recommandation CNIL)

const isChoice = (v: string | null | undefined): v is CookieConsentChoice => v === 'accepted' || v === 'rejected'

// Pour partager le choix entre sous-domaines (vitrine et application) : NEXT_PUBLIC_COOKIE_DOMAIN=.exemple.com
const domainAttribute = () => (process.env.NEXT_PUBLIC_COOKIE_DOMAIN ? `; domain=${process.env.NEXT_PUBLIC_COOKIE_DOMAIN}` : '')

export function getCookieConsent(): CookieConsentChoice | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${KEY}=([^;]*)`))
  const value = match ? decodeURIComponent(match[1]) : null
  return isChoice(value) ? value : null
}

export function setCookieConsent(choice: CookieConsentChoice) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${KEY}=${choice}; path=/${domainAttribute()}; max-age=${MAX_AGE}; SameSite=Lax${secure}`
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: choice }))
}

export function onCookieConsentChange(callback: (choice: CookieConsentChoice) => void) {
  const handler = (e: Event) => callback((e as CustomEvent<CookieConsentChoice>).detail)
  window.addEventListener(CHANGED, handler)
  return () => window.removeEventListener(CHANGED, handler)
}

export const openCookieConsentSettings = () => window.dispatchEvent(new Event(OPEN))
export function onOpenCookieConsentSettings(callback: () => void) {
  window.addEventListener(OPEN, callback)
  return () => window.removeEventListener(OPEN, callback)
}
