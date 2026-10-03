import type { Metadata } from 'next'
import './globals.css'
import { site } from '@/config/site'
import { DialogProvider } from '@/components/ui/dialog'

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { title: site.name, description: site.description, siteName: site.name, locale: site.locale, type: 'website' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={site.locale.slice(0, 2)}>
      <body>
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  )
}
