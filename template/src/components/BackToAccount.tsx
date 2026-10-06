import Link from 'next/link'

// Bouton « ← Mon compte » des pages autonomes (retour de paiement, facture…) : toujours visible
// (collé sous le bandeau du haut quand on fait défiler), jamais imprimé.
export function BackToAccount({ href = '/dashboard', label = 'Mon compte' }: { href?: string; label?: string }) {
  return (
    <div className="sticky top-14 z-30 px-4 pt-3 print:hidden sm:px-6">
      <Link href={href} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
        <span aria-hidden>←</span> {label}
      </Link>
    </div>
  )
}
