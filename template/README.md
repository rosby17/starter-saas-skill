# SaaS Starter Kit

A copy-pasteable Next.js (App Router) starter extracted from a production app, wired end-to-end with:

- **Auth** — Supabase email/password auth (login, signup, password reset), session refresh in `src/middleware.ts`
- **Billing** — TaraMoney and Maketou checkout/webhook/reconciliation flows backed by a simple credits ledger
- **Admin dashboard** — overview, users, support, feedback, announcements, maintenance-mode toggle
- **Email** — Brevo transactional email client + generic templates
- **Infra** — Dockerfile for `next build --standalone`, security headers in `next.config.ts`

## Setup

1. **Create a Supabase project** and run the migration:
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push
   ```
   This creates `profiles`, `orders`, `credits`, `system_settings`, and `announcements`. See `supabase/migrations/0001_init.sql`.

2. **Copy env vars**:
   ```bash
   cp .env.example .env.local
   ```
   Fill in Supabase keys, TaraMoney and/or Maketou credentials, and Brevo credentials (see comments in `.env.example`).

3. **Install and run**:
   ```bash
   npm install
   npm run dev
   ```

4. **Deploy**: build with the included `Dockerfile` (`next build` in standalone mode) on any Docker host (Coolify, Fly.io, etc.).

## Paiements : un flux unique, orchestré par l'administrateur

Même schéma pour tous les SaaS (celui d'iziVoice) :

1. Le client choisit un **type** de paiement (Mobile Money, carte, PayPal) sur `/billing`. Il ne choisit jamais une passerelle.
2. `POST /api/payment/checkout` : l'identité vient de la **session**, le prix du **catalogue serveur** (`src/lib/pricing.ts`), la passerelle du **réglage admin** (`/admin/payment-providers`, un seul moyen actif par type, stocké dans `system_settings`). La commande est enregistrée « pending ».
3. La passerelle est un **adaptateur** (`src/lib/payments/gateways/<id>.ts`) qui implémente `PaymentGateway` : `isConfigured()` et `createCheckout()`.
4. Le crédit se fait toujours par `creditPaidOrder` (atomique, jamais deux fois), déclenché par :
   - **TaraMoney** : le webhook `api/payment/webhook/taramoney` (secret partagé dans l'URL de rappel, `TARA_WEBHOOK_SECRET`) ;
   - **Maketou** (pas de webhook) : le retour sur `/billing/success` (`api/payment/verify`), puis le cron `api/cron/reverify-maketou-orders` pour les clients qui ferment l'onglet (protégé par `CRON_SECRET`, protégé aussi contre le chevauchement par `cron_locks`).
5. Filets de sécurité : `api/payment/reconcile-pending` (au retour de l'utilisateur) et `api/payment/expire-stale-orders` (expire les commandes jamais payées).

**Ajouter une passerelle** : un fichier dans `gateways/`, l'enregistrer dans `gateways/index.ts`, la lister dans `providers.ts` pour les types où elle marche, puis une route webhook ou une vérification selon qu'elle prévient ou non le site.

## Must-replace before shipping

- **Branding**: every `{{APP_NAME}}` placeholder (layout title, auth pages, emails) and `yoursaas.app` — search the repo for both.
- **Pricing**: `src/lib/pricing.ts` has three placeholder plans (Free/Pro/Business) with fake prices and credit amounts. Replace with your real plans.
- **TaraMoney keys**: `TARA_API_KEY`, `TARA_BUSINESS_ID`, `TARA_WEBHOOK_SECRET` in your env — generate a fresh random `TARA_WEBHOOK_SECRET`, never reuse one from another project.
- **Maketou keys**: `MAKETOU_API_KEY`, `MAKETOU_PRODUCT_ID`, and `CRON_SECRET` if you enable the `reverify-maketou-orders` cron. If you don't plan to accept mobile money via Maketou, you can delete its branch in `checkout/route.ts`, the Maketou block in `verify/route.ts`, and the whole `src/app/api/cron/reverify-maketou-orders` route.
- **Supabase project keys**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Admin gate**: `src/app/admin/layout.tsx` checks `profiles.is_admin` — you must manually flip that flag to true for your own account after signing up (no UI for this on purpose).
- **Email templates**: `public/email-templates/*.html` are meant to be pasted into Supabase Auth's email template settings (Authentication > Email Templates). `src/lib/email/templates.ts` covers app-triggered emails (purchase confirmation, etc).
- **`support_tickets` / `feedbacks` tables**: the admin pages for these read from tables that are *not* created by the included migration (they weren't part of the core billing/auth scope this kit copies) — create them yourself or remove the pages.

## What's intentionally excluded

- Any product-specific logic (voice/audio/AI generation in the source app) — this kit only carries the SaaS scaffolding around it.
- Multi-domain/multi-deployment middleware branching, affiliate program, promo campaigns, cloned-voices/orders/balance/blogs/keys admin pages — all specific to the source app's product.
- Binance Pay (manual/no-API-callback provider) — TaraMoney and Maketou are wired up; add others by branching in `src/app/api/payment/checkout/route.ts`.
- `src/lib/error-sanitizer.ts` and `src/lib/security.ts` equivalents from the source app — both were tightly coupled to source-app-specific upstream providers and WhatsApp-based fraud checks, not generic.
