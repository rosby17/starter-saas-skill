import type { MetadataRoute } from 'next'
import { site } from '@/config/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin', '/api', '/settings', '/billing', '/support'] },
    sitemap: `${site.url}/sitemap.xml`,
  }
}
