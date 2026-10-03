import Link from 'next/link'
import { site } from '@/config/site'
import { Logo } from '@/components/Logo'

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="text-lg"><Logo /></Link>
        <nav className="hidden gap-6 text-sm text-gray-600 md:flex">
          {site.nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-gray-900">{item.label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-700 hover:text-gray-900">Se connecter</Link>
          <Link href="/signup" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">Commencer</Link>
        </div>
      </div>
    </header>
  )
}
