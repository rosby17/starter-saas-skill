'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-xl font-semibold">Une erreur est survenue.</p>
      <p className="text-gray-600">Réessaie dans un instant. Si le problème continue, contacte le support.</p>
      <button onClick={reset} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">Réessayer</button>
    </main>
  )
}
