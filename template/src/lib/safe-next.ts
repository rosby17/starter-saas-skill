// Adresse de retour (?next=…, ?vers=…) : seulement une page de CE site, jamais un autre domaine
// (sinon un lien piégé renverrait le client vers un faux site). Leçon de l'audit Ballon Viral du 07/11/2026 :
// les navigateurs lisent « \ » comme « / » et ignorent tabulations et retours à la ligne, donc
// « /\evil.com » ou « /<tab>/evil.com » partaient ailleurs. On refuse ces caractères, puis on vérifie
// que l'adresse résolue reste sur le même site.
const BASE = 'https://site.invalid'

export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || next.length > 2000 || !next.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback
  try {
    const url = new URL(next, BASE)
    if (url.origin !== BASE) return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}
