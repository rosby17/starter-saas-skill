import type { MetadataRoute } from 'next'
import { site } from '@/config/site'

// Application installable (PWA) : l'espace élève s'ouvre comme une appli sur le téléphone, en plein écran.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: site.name,
    short_name: site.name.slice(0, 12),
    description: site.description,
    lang: 'fr',
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0D0D0D',
    theme_color: '#0D0D0D',
    categories: ['education'],
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Formations', url: '/mes-achats', icons: [{ src: '/pwa/icon-192.png', sizes: '192x192' }] },
      { name: 'Boutique', url: '/dashboard/boutique', icons: [{ src: '/pwa/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
