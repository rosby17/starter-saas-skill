import Link from 'next/link'
import { site } from '@/config/site'
import { CookieSettingsLink } from '@/components/CookieSettingsLink'

export function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-sm text-gray-500 sm:flex-row sm:items-center">
        <p>© {new Date().getFullYear()} {site.name}. Tous droits réservés.</p>
        <nav className="flex gap-5 sm:ml-auto">
          <Link href="/terms" className="hover:text-gray-900">Conditions</Link>
          <Link href="/privacy" className="hover:text-gray-900">Confidentialité</Link>
          <Link href="/mentions-legales" className="hover:text-gray-900">Mentions légales</Link>
          <CookieSettingsLink className="hover:text-gray-900" />
          <a href={`mailto:${site.supportEmail}`} className="hover:text-gray-900">Contact</a>
        </nav>
      </div>
    </footer>
  )
}
