#!/usr/bin/env node
// Cherche les liens internes cassés : part du sitemap, ouvre chaque page, relève
// tous les liens internes (href="/...") et vérifie leur code de réponse.
// À lancer contre le site LOCAL (npm run dev) pour ne pas charger la production.
// Usage : node "<dossier du skill>/scripts/verifier_liens.mjs" [adresse=http://localhost:3000] [domaine_public]
// Ex. : node verifier_liens.mjs http://localhost:3000 https://izivoice.app
// Sortie : nombre de pages, de liens, et chaque lien en erreur avec la page où il a été trouvé.
const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const PUBLIC = (process.argv[3] || '').replace(/\/$/, '');
const OK = new Set([200, 301, 302, 307, 308]);

const sitemap = await (await fetch(BASE + '/sitemap.xml')).text();
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => PUBLIC ? m[1].replace(PUBLIC, BASE) : m[1]);
const cache = new Map();
const foundOn = new Map();
const check = (url) => {
  if (!cache.has(url)) cache.set(url, fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(90000) }).then(r => r.status).catch(e => `ERR ${e.name}`));
  return cache.get(url);
};

const links = new Set();
for (const page of pages) {
  if ((await check(page)) !== 200) continue;
  const html = await (await fetch(page)).text();
  for (const m of html.matchAll(/href="([^"#?]+)(?:[#?][^"]*)?"/g)) {
    const href = m[1];
    if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/_next')) continue;
    if (/\.(png|jpe?g|webp|svg|ico|css|js|xml|txt|json|woff2?)$/i.test(href)) continue;
    const url = BASE + href;
    links.add(url);
    if (!foundOn.has(url)) foundOn.set(url, page.replace(BASE, ''));
  }
}

const all = [...new Set([...pages, ...links])];
const broken = [];
for (let i = 0; i < all.length; i += 4) {
  const batch = all.slice(i, i + 4);
  const statuses = await Promise.all(batch.map(check));
  batch.forEach((url, k) => { if (!OK.has(statuses[k])) broken.push([url.replace(BASE, ''), statuses[k]]); });
}
console.log(`Pages du sitemap : ${pages.length} · liens internes uniques : ${links.size} · vérifiés : ${all.length}`);
console.log(`Liens en erreur : ${broken.length}`);
for (const [url, status] of broken) console.log(`  ${status}  ${url}  (trouvé sur ${foundOn.get(BASE + url) || 'sitemap'})`);
process.exit(broken.length ? 1 : 0);
