'use client'

import './globals.css'

// Dernier filet : une erreur dans la mise en page principale (que error.tsx ne peut pas attraper).
// Remplace toute la page, d'où ses propres balises html et body.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-xl font-semibold">Une erreur est survenue.</p>
          <p className="text-gray-600">Réessaie dans un instant. Si le problème continue, contacte le support.</p>
          <button onClick={reset} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">Réessayer</button>
        </main>
      </body>
    </html>
  )
}
