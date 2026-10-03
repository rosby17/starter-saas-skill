/**
 * Generic transactional email templates. Kept intentionally simple —
 * swap in your own HTML/branding, or point these at Brevo template IDs
 * instead of inline HTML if you prefer managing copy in the Brevo UI.
 */

// Tout texte inséré dans un e-mail HTML passe par esc() : un nom ou un forfait ne doit jamais injecter de HTML.
const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "{{APP_NAME}}";

function wrapper(bodyHtml: string): string {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1f2937;">
    <h2 style="margin: 0 0 16px;">${APP_NAME}</h2>
    ${bodyHtml}
    <p style="margin-top: 32px; font-size: 12px; color: #9ca3af;">
      This is an automated message from ${APP_NAME}.
    </p>
  </div>`;
}

export function welcomeTemplate({ firstName }: { firstName?: string }): string {
  return wrapper(`
    <p>Bonjour ${esc(firstName || "")},</p>
    <p>Welcome to ${APP_NAME}! Your account is ready to go.</p>
  `);
}

export function rechargeConfirmationTemplate({
  credits,
  amount,
  planName,
}: {
  credits: number;
  amount: string;
  planName: string;
}): string {
  return wrapper(`
    <p>Your purchase is confirmed.</p>
    <p><strong>${esc(planName)}</strong> — ${esc(amount)}</p>
    <p>${credits.toLocaleString()} credits have been added to your account.</p>
  `);
}

export function genericNotificationTemplate({
  title,
  message,
}: {
  title: string;
  message: string;
}): string {
  return wrapper(`
    <h3 style="margin: 0 0 8px;">${esc(title)}</h3>
    <p>${esc(message)}</p>
  `);
}
