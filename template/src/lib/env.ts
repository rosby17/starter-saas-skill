// Fail-fast validation of critical env vars at startup. Avoids a deployment
// silently running with `undefined` values (cryptic runtime errors, or
// falling back to insecure defaults).

// Seul le socle est obligatoire : les clés de chaque passerelle de paiement et de Brevo sont vérifiées
// au moment de leur usage (PaymentGateway.isConfigured), pour qu'un SaaS sans Tara ou sans Brevo démarre.
const REQUIRED_SERVER_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

export function assertServerEnv(): void {
  const missing = REQUIRED_SERVER_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}. ` +
      `The app cannot start safely without them.`
    );
  }
}
