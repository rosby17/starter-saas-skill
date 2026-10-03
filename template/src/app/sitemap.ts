import type { MetadataRoute } from 'next'
import { site } from '@/config/site'

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/pricing', '/terms', '/privacy', '/mentions-legales', '/login', '/signup'].map((path) => ({
    url: `${site.url}${path}`,
    lastModified: new Date(),
  }))
}
