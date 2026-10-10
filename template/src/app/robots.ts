import type { MetadataRoute } from 'next'
import { site } from '@/config/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin', '/api', '/settings', '/billing', '/billing-history', '/support', '/mes-achats', '/credits', '/cours', '/demandes', '/paiement', '/auth'] },
    sitemap: `${site.url}/sitemap.xml`,
  }
}
