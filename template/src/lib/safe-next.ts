// Adresse de retour après connexion (?next=…) : seulement une page de CE site, jamais un autre domaine
// (sinon un lien piégé renverrait le client, juste connecté, vers un faux site).
export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
