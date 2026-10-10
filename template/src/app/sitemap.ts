import type { MetadataRoute } from 'next'
import { site } from '@/config/site'
import { getPublishedProducts } from '@/lib/catalog/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ['', '/boutique', '/formations', '/terms', '/privacy', '/mentions-legales', '/login']
  const products = (await getPublishedProducts()).filter((p) => !p.sales_url && !p.external_url).map((p) => `/boutique/${p.slug}`)
  return [...pages, ...products].map((path) => ({ url: `${site.url}${path}`, lastModified: new Date() }))
}
