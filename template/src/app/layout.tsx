import type { Metadata } from 'next'
import './globals.css'
import { site } from '@/config/site'
import { DialogProvider } from '@/components/ui/dialog'
import { brandFont } from '@/app/fonts/brand-font'
import { ThemeInitScript } from '@/components/site/ThemeToggle'
import MotionProvider from '@/components/site/MotionProvider'
import MetaPixel from '@/components/site/MetaPixel'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'
import { CheckoutProvider } from '@/components/site/CheckoutModal'
import { CookieConsentBanner } from '@/components/CookieConsentBanner'
import { CatalogProvider } from '@/lib/catalog/context'
import { getPublishedProducts } from '@/lib/catalog/server'

// Rendu à la demande : le catalogue (prix, promos) vient de la base, réglé dans /admin/products.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — ${site.tagline}`, template: `%s — ${site.name}` },
  description: site.description,
  openGraph: {
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    siteName: site.name,
    locale: site.locale,
    type: 'website',
    images: [{ url: '/og.png', width: 1024, height: 1024, alt: site.name }],
  },
  twitter: { card: 'summary_large_image', title: `${site.name} — ${site.tagline}`, description: site.description, images: ['/og.png'] },
  robots: { index: true, follow: true },
  // Application installable (manifest.ts) : icône et barre d'état sur iPhone.
  icons: { apple: '/pwa/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: site.name, statusBarStyle: 'black-translucent' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const products = await getPublishedProducts()
  return (
    <html lang="fr" className={brandFont.variable} suppressHydrationWarning>
      <head>
        <ThemeInitScript />
      </head>
      <body>
        <CatalogProvider products={products}>
          <DialogProvider>
            <CheckoutProvider>{children}</CheckoutProvider>
          </DialogProvider>
        </CatalogProvider>
        <MotionProvider />
        <ServiceWorkerRegister />
        <MetaPixel />
        <CookieConsentBanner />
      </body>
    </html>
  )
}
