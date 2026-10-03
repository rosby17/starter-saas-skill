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

## Payment providers

The checkout route (`src/app/api/payment/checkout/route.ts`) supports two providers, selected by passing `provider: 'taramoney' | 'maketou'` from the client (TaraMoney is the default when `provider` is omitted). Both write to the same `orders` table and credit through the same `credits` ledger — the difference is how each provider tells you a payment succeeded:

- **TaraMoney** — has a webhook. `src/app/api/payment/webhook/taramoney/route.ts` receives the callback, authenticates it via a shared secret embedded in the callback URL (`TARA_WEBHOOK_SECRET` — TaraMoney doesn't support HMAC signing), verifies the paid amount against what was due, and credits the order. The `/billing/success` page polls `src/app/api/payment/verify/route.ts` just to report status while it waits for the webhook.
- **Maketou** — has **no webhook**. Crediting instead happens two ways: (1) when the customer's browser returns to `/billing/success`, `verify/route.ts` actively polls Maketou's cart-status API and credits the order itself; (2) as a safety net for customers who close the tab before returning (e.g. they paid from a separate mobile money app), `src/app/api/cron/reverify-maketou-orders/route.ts` re-checks recent pending/failed Maketou orders on a schedule. Wire this route to your scheduler (cron, Coolify scheduled task, etc.) protected by `CRON_SECRET`, e.g. hitting it every minute with `?hours=2` for a shallow pass and once a day with no params for a 7-day deep sweep.

Add another provider by adding a third branch in `checkout/route.ts` following the same pattern, plus a webhook or polling/reconciliation route depending on what the provider supports.

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
