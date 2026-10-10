// Service worker du site (application installable).
// - Pages : réseau d'abord ; sans connexion, page hors ligne.
// - Fichiers statiques (_next/static, icônes, logos) : cache d'abord.
// - JAMAIS de cache pour l'API, l'authentification, l'admin, les paiements, les leçons ni les médias
//   (les vidéos passent par des liens signés courts et ne doivent pas rester sur le téléphone).
const VERSION = 'rf-v1'
const STATIC = `${VERSION}-static`
const OFFLINE = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, '/pwa/icon-192.png', '/photo.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

const NEVER = [/^\/api\//, /^\/auth\//, /^\/admin/, /^\/paiement/, /^\/cours\//, /^\/billing/]
const STATIC_FILE = /^\/(_next\/static|pwa|logos|produits|services)\/|\.(woff2?|otf)$/

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.headers.has('range')) return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || NEVER.some((r) => r.test(url.pathname))) return

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)))
    return
  }
  if (STATIC_FILE.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') caches.open(STATIC).then((c) => c.put(req, res.clone()))
        return res
      }))
    )
  }
})
