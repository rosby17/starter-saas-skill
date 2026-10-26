#!/usr/bin/env node
// VERROU DE LA PAGE DE PAIEMENT (brique du kit starter-saas, validée le 10/10/2026).
//
// La page de paiement, ses moyens (Mobile Money, Wave, carte, PayPal, crypto), leur disposition et tout le circuit
// d'une commande (création, passerelles, webhooks, vérification, livraison, facture) sont IDENTIQUES sur tous les
// SaaS du kit. Ce script compare chaque fichier de la brique à son empreinte (paiement.lock.json) et BLOQUE
// `npm run lint`, `npm run build` (donc la mise en ligne) et la CI si l'un d'eux a été modifié ou supprimé.
//
// Ce qui se règle SANS toucher à la brique : src/config/site.ts (nom, logo, WhatsApp, pays par défaut, fuseau),
// les clés dans /admin/keys (Tara Money, Warappay, Wave, Binance, USDT) et la passerelle active par moyen
// dans /admin/payment-providers. Les produits et les prix sont en base (/admin/products).
//
// Faire évoluer la brique : uniquement DANS LE KIT (dépôt starter-saas-skill), puis
//   node template/scripts/verrou-paiement.mjs --signer      (refusé hors du kit)
// et réinstaller la brique dans les projets avec scripts/installer-paiement.sh du kit.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lockPath = join(root, 'paiement.lock.json')

// Fichiers de la brique (chemins depuis la racine du projet).
export const FILES = [
  'src/components/site/CheckoutModal.tsx',
  'src/components/ui/phone-input.tsx',
  'src/app/(marketing)/paiement/succes/page.tsx',
  'src/app/(marketing)/paiement/succes/PaymentStatus.tsx',
  'src/app/api/payment/checkout/route.ts',
  'src/app/api/payment/enter/route.ts',
  'src/app/api/payment/methods/route.ts',
  'src/app/api/payment/verify/route.ts',
  'src/app/api/payment/reconcile-pending/route.ts',
  'src/app/api/payment/expire-stale-orders/route.ts',
  'src/app/api/payment/webhook/taramoney/route.ts',
  'src/app/api/payment/webhook/warappay/route.ts',
  'src/app/api/cron/reconcile-orders/route.ts',
  'src/app/admin/payment-providers/page.tsx',
  'src/app/api/admin/payment-providers/route.ts',
  'src/app/api/admin/payment-providers/[category]/route.ts',
  'src/lib/payments/providers.ts',
  'src/lib/payments/settings.ts',
  'src/lib/payments/settle.ts',
  'src/lib/payments/signature.ts',
  'src/lib/payments/types.ts',
  'src/lib/payments/manual-contact.ts',
  'src/lib/payments/gateways/index.ts',
  'src/lib/payments/gateways/taramoney.ts',
  'src/lib/payments/gateways/warappay.ts',
  'src/lib/payments/gateways/maketou.ts',
  'src/lib/payments/gateways/wave.ts',
  'src/lib/payments/gateways/binance.ts',
  'src/lib/payments/gateways/momo-direct.ts',
  'src/lib/payments/gateway-alert.ts',
  'src/lib/orders/credit-order.ts',
  'src/lib/orders/deliver.ts',
  'src/lib/orders/expire-pending.ts',
  'src/lib/orders/order-cookie.ts',
  'src/lib/pricing/zones.ts',
  'src/lib/pricing/server.ts',
  'src/lib/content/display-currency.ts',
]

// Empreinte insensible aux fins de ligne (Windows / Mac) : le contenu compte, pas l'éditeur.
const hash = (file) => createHash('sha256').update(readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n')).digest('hex')

if (process.argv.includes('--signer')) {
  // Seul le kit signe : le dossier parent du modèle contient le SKILL.md du skill starter-saas.
  const skill = join(root, '..', 'SKILL.md')
  if (!existsSync(skill) || !/name:\s*starter-saas/.test(readFileSync(skill, 'utf8'))) {
    console.error('Refusé : la brique de paiement se signe uniquement dans le kit starter-saas (template/), jamais dans un projet.')
    process.exit(1)
  }
  const lock = { brique: 'paiement', version: new Date().toISOString().slice(0, 10), files: Object.fromEntries(FILES.map((f) => [f, hash(f)])) }
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
  console.log(`Brique de paiement signée : ${FILES.length} fichiers (${lock.version}).`)
  process.exit(0)
}

if (!existsSync(lockPath)) {
  console.error('Verrou de paiement absent (paiement.lock.json) : réinstalle la brique de paiement du kit starter-saas.')
  process.exit(1)
}
const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
const problems = []
for (const [file, expected] of Object.entries(lock.files)) {
  if (!existsSync(join(root, file))) problems.push(`supprimé : ${file}`)
  else if (hash(file) !== expected) problems.push(`modifié  : ${file}`)
}
if (problems.length) {
  console.error(`\n✖ PAGE DE PAIEMENT VERROUILLÉE (brique du kit starter-saas, version ${lock.version})\n`)
  for (const p of problems) console.error(`  ${p}`)
  console.error(`\n  La page de paiement et son circuit sont communs à tous les SaaS : on ne les modifie pas dans un projet.`)
  console.error(`  Annule ces changements (git checkout -- <fichier>) et règle plutôt :`)
  console.error(`    · src/config/site.ts (nom, logo, WhatsApp, pays par défaut) ;`)
  console.error(`    · /admin/keys (Tara Money, Warappay, Wave, Binance, USDT) et /admin/payment-providers ;`)
  console.error(`    · les produits et les prix dans /admin/products.`)
  console.error(`  Une amélioration utile à tous se fait dans le kit, puis la brique est réinstallée partout.\n`)
  process.exit(1)
}
console.log(`✓ Page de paiement intacte (brique du kit, version ${lock.version}, ${Object.keys(lock.files).length} fichiers).`)
