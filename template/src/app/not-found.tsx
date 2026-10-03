import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-6xl font-bold">404</p>
      <p className="text-gray-600">Cette page n'existe pas.</p>
      <Link href="/" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">Retour à l'accueil</Link>
    </main>
  )
}
