/**
 * Modèles des e-mails envoyés par le site (HTML simple, à habiller aux couleurs du SaaS).
 * Chaque modèle se déclare aussi dans EMAIL_EXAMPLES (en bas) avec des données fictives : le bouton
 * « M'envoyer un exemple de chaque e-mail » (Administration › E-mails) les envoie tous à l'admin.
 * Règle : jamais de code ni de secret dans le SUJET d'un e-mail (les sujets sont journalisés).
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
      Message automatique de ${APP_NAME}.
    </p>
  </div>`;
}

export function welcomeTemplate({ firstName }: { firstName?: string }): string {
  return wrapper(`
    <p>Bonjour ${esc(firstName || "")},</p>
    <p>Bienvenue sur ${APP_NAME} ! Ton compte est prêt.</p>
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
    <p>Ton achat est confirmé.</p>
    <p><strong>${esc(planName)}</strong> : ${esc(amount)}</p>
    <p>${credits.toLocaleString("fr-FR")} crédits ont été ajoutés à ton compte.</p>
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

/** Code de validation en deux étapes. Le code est dans le CORPS uniquement, jamais dans le sujet. */
export function twoFactorCodeTemplate({ code, purpose }: { code: string; purpose: "login" | "enable" }): string {
  return wrapper(`
    <p>${purpose === "enable" ? "Voici ton code pour activer la validation en deux étapes par e-mail :" : "Voici ton code de connexion :"}</p>
    <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 16px 0;">${esc(code)}</p>
    <p>Il est valable 10 minutes et ne sert qu'une fois.</p>
    <p style="color: #6b7280; font-size: 13px;">Tu n'as rien demandé ? Ignore cet e-mail et change ton mot de passe : quelqu'un le connaît peut-être.</p>
  `);
}

export const TWO_FACTOR_SUBJECT = `Ton code de connexion ${APP_NAME}`;

/** Un exemple par modèle : sujet et HTML remplis avec des données fictives. */
export type EmailExample = { id: string; label: string; subject: string; html: () => string | Promise<string> };

// Modèles de Supabase Auth (public/email-templates, utilisés par la base pour la confirmation d'inscription,
// le mot de passe oublié, le changement d'adresse) : on remplace leurs variables par des valeurs fictives.
async function authTemplate(file: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const html = await readFile(path.join(process.cwd(), "public", "email-templates", file), "utf8");
  return html
    .replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, `${site}/auth/callback?exemple=1`)
    .replace(/\{\{\s*\.SiteURL\s*\}\}/g, site)
    .replace(/\{\{\s*\.RedirectTo\s*\}\}/g, `${site}/reset-password`)
    .replace(/\{\{\s*\.TokenHash\s*\}\}/g, "exemple")
    .replace(/\{\{\s*\.Token\s*\}\}/g, "123456")
    .replace(/\{\{\s*\.NewEmail\s*\}\}/g, "nouvelle.adresse@exemple.com")
    .replace(/\{\{\s*\.Email\s*\}\}/g, "client@exemple.com");
}

export const EMAIL_EXAMPLES: EmailExample[] = [
  { id: "welcome", label: "Bienvenue", subject: `Bienvenue sur ${APP_NAME}`, html: () => welcomeTemplate({ firstName: "Awa" }) },
  { id: "recharge-confirmation", label: "Achat confirmé", subject: "Ton achat est confirmé",
    html: () => rechargeConfirmationTemplate({ credits: 5000, amount: "5 000 XOF", planName: "Forfait Créateur" }) },
  { id: "notification", label: "Notification", subject: "Une nouvelle notification",
    html: () => genericNotificationTemplate({ title: "Ta vidéo est prête", message: "Elle t'attend dans ton espace." }) },
  { id: "two-factor-code", label: "Code de connexion (validation en deux étapes)", subject: TWO_FACTOR_SUBJECT,
    html: () => twoFactorCodeTemplate({ code: "482913", purpose: "login" }) },
  { id: "auth-confirmation", label: "Confirmation d'inscription (Supabase)", subject: "Confirme ton adresse e-mail", html: () => authTemplate("confirmation.html") },
  { id: "auth-recovery", label: "Mot de passe oublié (Supabase)", subject: "Choisis un nouveau mot de passe", html: () => authTemplate("recovery.html") },
  { id: "auth-email-change", label: "Changement d'adresse (Supabase)", subject: "Confirme ta nouvelle adresse", html: () => authTemplate("email-change.html") },
];
