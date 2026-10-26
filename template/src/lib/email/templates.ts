/**
 * E-mails transactionnels. CLAIRS par défaut (blanc, rouge #C8102E) ; ils passent en sombre seulement si la messagerie
 * du lecteur est en thème sombre (prefers-color-scheme : Apple Mail, iOS, Outlook ; Gmail adapte lui-même ses couleurs).
 * Tout texte inséré passe par esc() : un nom ou un titre ne doit jamais injecter de HTML.
 */

export const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

import { contactChannel, contactLink, site } from "@/config/site";

const APP_NAME = site.name;
const CONTACT = contactLink();

// Couleurs claires en ligne (lues partout) ; les classes rm-* les remplacent en thème sombre.
const DARK_CSS = `
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    .rm-bg { background:#0D0D0D !important; }
    .rm-card { background:#141414 !important; border-color:#2A2A2A !important; color:#FAFAFA !important; }
    .rm-muted { color:#9A9A9A !important; }
    .rm-soft { background:#1E1E1E !important; }
    .rm-link { color:#D6D6D6 !important; }
  }`;

function wrapper(bodyHtml: string): string {
  return `<!doctype html><html><head><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><style>${DARK_CSS}</style></head>
  <body style="margin:0;padding:0;">
  <div class="rm-bg" style="background:#F5F5F7;padding:32px 12px;">
    <div class="rm-card" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 28px;background:#FFFFFF;border:1px solid #E5E5EA;border-radius:18px;color:#1C1C1E;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 24px;font-size:18px;font-weight:600;letter-spacing:-0.02em;">${APP_NAME}<span style="color:#C8102E;">.</span></p>
      ${bodyHtml}
      <p class="rm-muted" style="margin-top:32px;font-size:12px;color:#6E6E73;">
        Une question ? Réponds à cet e-mail ou écris-nous sur <a class="rm-link" href="${CONTACT}" style="color:#3A3A3C;">${contactChannel()}</a>.
      </p>
    </div>
  </div>
  </body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:28px 0;"><a href="${esc(href)}" style="display:inline-block;background:#C8102E;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:999px;">${esc(label)}</a></p>`;
}

const linkNote = (href: string) =>
  `<p class="rm-muted" style="font-size:12px;color:#6E6E73;">Le bouton ne marche pas ? Copie ce lien dans ton navigateur :<br><span class="rm-link" style="word-break:break-all;color:#3A3A3C;">${esc(href)}</span></p>
   <p class="rm-muted" style="font-size:12px;color:#6E6E73;">Ce lien te connecte directement : ne le transfère à personne. Il expire au bout d'une heure ; tu peux en redemander un à tout moment sur la page Connexion.</p>`;

/** Accès livré après un paiement, un accès donné par l'admin ou un import : l'e-mail de bienvenue. */
export function accessReadyTemplate({ name, products, loginUrl, amount, invoice }: { name?: string | null; products: string[]; loginUrl: string; amount?: string | null; invoice?: string | null }): string {
  const list = products.map((p) => `<li style="margin:4px 0;"><strong>${esc(p)}</strong></li>`).join("");
  return wrapper(`
    <p style="font-size:22px;font-weight:600;letter-spacing:-0.02em;margin:0 0 12px;">Bienvenue${name ? ` ${esc(name)}` : ""} 🎉</p>
    <p>${amount ? `Ton paiement de <strong>${esc(amount)}</strong> est confirmé. ` : ""}Ton accès est prêt :</p>
    <ul style="padding-left:18px;">${list}</ul>
    <p>En entrant, je te pose quelques petites questions pour préparer <strong>ton</strong> parcours. Ensuite, tu avances leçon par leçon, à ton rythme, avec les vrais fichiers de mes projets.</p>
    ${button(loginUrl, "Commencer ma formation")}
    ${invoice ? `<p style="font-size:14px;">🧾 Ta facture <strong>${esc(invoice)}</strong> est jointe à cet e-mail (PDF). Tu la retrouves aussi dans « Factures ».</p>` : ""}
    <p class="rm-muted" style="font-size:13px;color:#6E6E73;">Tout reste dans ton espace : leçons, fichiers, groupe d’entraide et factures, depuis n’importe quel téléphone.</p>
    ${linkNote(loginUrl)}
  `);
}

/** Réservation (précommande, 10 %) confirmée : pas encore d'accès, la place est gardée. */
export function reservationTemplate({ name, product, amount, invoice, loginUrl }: { name?: string | null; product: string; amount?: string | null; invoice?: string | null; loginUrl: string }): string {
  return wrapper(`
    <p style="font-size:22px;font-weight:600;letter-spacing:-0.02em;margin:0 0 12px;">Ta place est réservée${name ? `, ${esc(name)}` : ""} ✅</p>
    <p>${amount ? `Ton paiement de <strong>${esc(amount)}</strong> est confirmé. ` : ""}Tu es sur la liste d’attente de <strong>${esc(product)}</strong>.</p>
    <p>Dès la sortie de la formation, je te préviens le premier. Tu finiras alors avec <strong>60 % du prix</strong> au lieu de 100 %, et ton accès s’ouvrira tout de suite.</p>
    ${invoice ? `<p style="font-size:14px;">🧾 Ta facture <strong>${esc(invoice)}</strong> est jointe à cet e-mail (PDF).</p>` : ""}
    ${button(loginUrl, "Voir ma réservation")}
    ${linkNote(loginUrl)}
  `);
}

/** Nouveauté d'une formation (nouveau module, nouvelle leçon) envoyée aux élèves. */
export function courseUpdateTemplate({ name, title, body, url }: { name?: string | null; title: string; body?: string | null; url: string }): string {
  return wrapper(`
    <p>Bonjour ${esc(name || "")},</p>
    <p style="font-size:20px;font-weight:600;letter-spacing:-0.02em;margin:16px 0 8px;">${esc(title)}</p>
    ${body ? `<p style="white-space:pre-line;">${esc(body)}</p>` : ""}
    <p>C’est déjà dans ton espace, à la suite de ton parcours.</p>
    ${button(url, "Voir la nouveauté")}
  `);
}

/** Lien de connexion demandé depuis la page Connexion. */
export function loginLinkTemplate({ loginUrl }: { loginUrl: string }): string {
  return wrapper(`
    <p>Bonjour,</p>
    <p>Voici ton lien pour te connecter à ton espace et retrouver tes achats.</p>
    ${button(loginUrl, "Me connecter")}
    ${linkNote(loginUrl)}
    <p class="rm-muted" style="font-size:12px;color:#6E6E73;">Tu n'as rien demandé ? Ignore simplement cet e-mail.</p>
  `);
}

/** Demande enregistrée (accompagnement, service sur devis, monétisation). */
export function requestReceivedTemplate({ name, kind, loginUrl }: { name?: string | null; kind: string; loginUrl: string }): string {
  return wrapper(`
    <p>Bonjour ${esc(name || "")},</p>
    <p>Ta demande « <strong>${esc(kind)}</strong> » est bien enregistrée. Je te réponds rapidement, et tu peux suivre son avancement dans ton espace.</p>
    ${button(loginUrl, "Suivre ma demande")}
    ${linkNote(loginUrl)}
  `);
}

/** Réponse ou changement de statut d'une demande. */
export function requestUpdateTemplate({ name, kind, status, reply, url }: { name?: string | null; kind: string; status: string; reply?: string | null; url: string }): string {
  return wrapper(`
    <p>Bonjour ${esc(name || "")},</p>
    <p>Ta demande « <strong>${esc(kind)}</strong> » est maintenant : <strong>${esc(status)}</strong>.</p>
    ${reply ? `<div class="rm-soft" style="margin:16px 0;padding:14px 16px;border-left:3px solid #C8102E;background:#F2F2F7;border-radius:8px;white-space:pre-line;">${esc(reply)}</div>` : ""}
    ${button(url, "Voir ma demande")}
  `);
}

/** Alerte envoyée à l'administrateur (nouvelle vente, nouvelle demande). */
export function adminAlertTemplate({ title, lines, url }: { title: string; lines: string[]; url: string }): string {
  return wrapper(`
    <p style="font-weight:600;">${esc(title)}</p>
    <ul style="padding-left:18px;">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
    ${button(url, "Ouvrir l'administration")}
  `);
}

export function genericNotificationTemplate({ title, message }: { title: string; message: string }): string {
  return wrapper(`<p style="font-weight:600;">${esc(title)}</p><p>${esc(message)}</p>`);
}

/** Code de la validation en deux étapes (par e-mail). Jamais le code dans le sujet. */
export function twoFactorCodeTemplate({ code, purpose }: { code: string; purpose: "login" | "enable" }): string {
  return wrapper(`
    <p>${purpose === "enable" ? "Voici ton code pour activer la validation en deux étapes par e-mail :" : "Voici ton code de connexion 🔐 :"}</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0;">${esc(code)}</p>
    <p>Il est valable 10 minutes et ne sert qu'une fois.</p>
    <p class="rm-muted" style="font-size:13px;color:#6E6E73;">Tu n'as rien demandé ? Ignore cet e-mail et change ton mot de passe : quelqu'un le connaît peut-être.</p>
  `);
}

export const TWO_FACTOR_SUBJECT = `Ton code de connexion ${APP_NAME}`;

/** Compte suspendu : le motif choisi par l'administrateur (texte préétabli) et comment nous joindre. */
export function accountSuspendedTemplate({ reason }: { reason: string }): string {
  return wrapper(`
    <p style="font-weight:600;">Ton compte ${esc(APP_NAME)} a été suspendu</p>
    <p>Bonjour,</p>
    <p>Nous avons suspendu ton compte pour la raison suivante :</p>
    <p class="rm-soft" style="background:#F5F5F7;border-radius:12px;padding:12px 14px;">${esc(reason)}</p>
    <p>Si tu penses qu'il s'agit d'une erreur, réponds simplement à cet e-mail en nous expliquant ta situation (site web, activité, page professionnelle) : nous réexaminons chaque demande.</p>
    <p class="rm-muted" style="font-size:13px;color:#6E6E73;">Aucune donnée n'est supprimée pendant l'examen de ta demande.</p>
  `);
}

/** Crédits ajoutés (ou repris) par l'administrateur : montant, justification, nouveau solde. */
export function creditsAdjustedTemplate({ name, amount, note, balance, url }: { name?: string | null; amount: number; note?: string | null; balance?: number | null; url: string }): string {
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const added = amount > 0;
  return wrapper(`
    <p>Bonjour${name ? ` ${esc(name)}` : ""},</p>
    <p>${added ? `Nous venons d'ajouter <strong>${fmt(amount)} crédits</strong> à ton compte 🎁.` : `Nous avons ajusté ton solde de <strong>${fmt(amount)} crédits</strong>.`}</p>
    ${note ? `<p class="rm-soft" style="background:#F5F5F7;border-radius:12px;padding:12px 14px;"><strong>Motif :</strong> ${esc(note)}</p>` : ""}
    ${balance != null ? `<p>Nouveau solde : <strong>${fmt(Math.max(0, balance))} crédits</strong>.</p>` : ""}
    ${button(url, "Voir mes crédits")}
  `);
}

/** Un exemple par modèle : sujet et HTML remplis avec des données fictives. */
export type EmailExample = { id: string; label: string; subject: string; html: () => string | Promise<string> };

// Modèles de Supabase Auth (public/email-templates, utilisés par la base pour la confirmation d'inscription,
// le mot de passe oublié, le changement d'adresse) : on remplace leurs variables par des valeurs fictives.
async function authTemplate(file: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const html = await readFile(path.join(process.cwd(), "public", "email-templates", file), "utf8");
  return html
    .replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, `${siteUrl}/auth/callback?exemple=1`)
    .replace(/\{\{\s*\.SiteURL\s*\}\}/g, siteUrl)
    .replace(/\{\{\s*\.RedirectTo\s*\}\}/g, `${siteUrl}/reset-password`)
    .replace(/\{\{\s*\.TokenHash\s*\}\}/g, "exemple")
    .replace(/\{\{\s*\.Token\s*\}\}/g, "123456")
    .replace(/\{\{\s*\.NewEmail\s*\}\}/g, "nouvelle.adresse@exemple.com")
    .replace(/\{\{\s*\.Email\s*\}\}/g, "client@exemple.com");
}

// « M'envoyer un exemple de chaque e-mail » (Administration › E-mails) : chaque nouveau modèle s'ajoute ici.
export const EMAIL_EXAMPLES: EmailExample[] = [
  { id: "account-suspended", label: "Compte suspendu (motif choisi)", subject: "Ton compte a été suspendu",
    html: () => accountSuspendedTemplate({ reason: "L’adresse e-mail utilisée provient d’un service d’adresses temporaires." }) },
  { id: "credits-adjusted", label: "Crédits ajoutés par l'administrateur", subject: "🎁 Des crédits ont été ajoutés à ton compte",
    html: () => creditsAdjustedTemplate({ name: "Awa", amount: 2000, note: "Geste commercial après un incident", balance: 2350, url: `${site.url}/credits` }) },
  { id: "access-ready", label: "Accès prêt (achat confirmé)", subject: "🎉 Bienvenue : ton accès est prêt",
    html: () => accessReadyTemplate({ name: "Awa", products: ["Formation exemple"], loginUrl: `${site.url}/login`, amount: "15 000 FCFA", invoice: "F-2026-0001" }) },
  { id: "reservation", label: "Place réservée (précommande)", subject: "✅ Ta place est réservée",
    html: () => reservationTemplate({ name: "Awa", product: "Formation exemple", amount: "1 500 FCFA", invoice: "F-2026-0002", loginUrl: `${site.url}/login` }) },
  { id: "course-update", label: "Nouveauté d'une formation", subject: "📣 Nouveau module disponible",
    html: () => courseUpdateTemplate({ name: "Awa", title: "Module 2 : aller plus loin", body: "Trois nouvelles leçons t'attendent.", url: `${site.url}/mes-achats` }) },
  { id: "login-link", label: "Lien de connexion", subject: `Ton lien de connexion ${APP_NAME}`, html: () => loginLinkTemplate({ loginUrl: `${site.url}/login` }) },
  { id: "request-received", label: "Demande reçue", subject: "Ta demande est bien reçue", html: () => requestReceivedTemplate({ name: "Awa", kind: "Projet sur mesure", loginUrl: `${site.url}/demandes` }) },
  { id: "request-update", label: "Réponse à une demande", subject: "Du nouveau sur ta demande",
    html: () => requestUpdateTemplate({ name: "Awa", kind: "Projet sur mesure", status: "En cours", reply: "Voici notre proposition.", url: `${site.url}/demandes` }) },
  { id: "admin-alert", label: "Alerte administrateur (vente)", subject: "🎉 Nouvelle vente : Formation exemple",
    html: () => adminAlertTemplate({ title: "Nouvelle vente", lines: ["Montant : 15 000 FCFA (Mobile Money)", "Client : Awa · awa@exemple.com"], url: `${site.url}/admin/orders` }) },
  { id: "notification", label: "Notification", subject: "Une nouvelle notification", html: () => genericNotificationTemplate({ title: "Ton appel est confirmé", message: "Rendez-vous mardi à 15 h." }) },
  { id: "two-factor-code", label: "Code de connexion (validation en deux étapes)", subject: TWO_FACTOR_SUBJECT, html: () => twoFactorCodeTemplate({ code: "482913", purpose: "login" }) },
  { id: "coach-message", label: "Message du coach (relance d'un client)", subject: "Votre projet avance-t-il ?",
    html: () => coachMessageTemplate({ text: "Bonjour Awa,\n\nNous avons vu que votre paiement n'a pas abouti. Nous restons à votre disposition pour vous aider.", ctaUrl: `${site.url}/boutique`, ctaLabel: "Reprendre ma commande", lang: "fr",
      signature: { name: "Prénom Nom", role: "Fondateur", company: APP_NAME, tagline: site.tagline, whatsapp: site.whatsapp, email: site.supportEmail, website: site.url, address: "" } }) },
  { id: "auth-confirmation", label: "Confirmation d'inscription (Supabase)", subject: "Confirme ton adresse e-mail", html: () => authTemplate("confirmation.html") },
  { id: "auth-recovery", label: "Mot de passe oublié (Supabase)", subject: "Choisis un nouveau mot de passe", html: () => authTemplate("recovery.html") },
  { id: "auth-email-change", label: "Changement d'adresse (Supabase)", subject: "Confirme ta nouvelle adresse", html: () => authTemplate("email-change.html") },
];

/** Signature nominative des messages du coach (réglée dans Administration › Coach › Réglages). */
export type CoachSignature = { name: string; role: string; company: string; tagline: string; whatsapp: string; email: string; website: string; address: string };

/**
 * Message personnel du coach (relance de clients, envoi groupé depuis /admin/coach) : le texte tel quel, au
 * « nous » et au vouvoiement, liens cliquables, un bouton s'il y a un lien, puis la signature nominative dans
 * la langue choisie. Une formule de fin déjà écrite dans le texte est retirée (la signature la remplace).
 */
export function coachMessageTemplate({ text, ctaUrl, ctaLabel, lang = "fr", signature }: { text: string; ctaUrl?: string | null; ctaLabel?: string; lang?: "fr" | "en"; signature: CoachSignature }): string {
  const en = lang === "en";
  const linkify = (line: string) => esc(line).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a class="rm-link" href="${url}" style="color:#3A3A3C;text-decoration:underline;">${url}</a>`);
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  while (blocks.length > 1 && blocks[blocks.length - 1].length < 160 && /^(bien\s+)?cordialement|^best\s+regards|^kind\s+regards|^regards|^bien\s+à\s+vous|^l[’']équipe\b|^the\s+\S+\s+team/i.test(blocks[blocks.length - 1])) blocks.pop();
  const paragraphs = blocks.map((b) => `<p style="margin:0 0 16px;">${b.split("\n").map(linkify).join("<br>")}</p>`).join("");
  const row = (label: string, value: string, href?: string) =>
    value ? `<tr><td style="font-size:13px;line-height:21px;"><span style="color:#C8102E;font-weight:600;">${esc(label)}</span>&nbsp;&nbsp;${href ? `<a class="rm-link" href="${esc(href)}" style="color:#3A3A3C;text-decoration:none;">${esc(value)}</a>` : esc(value)}</td></tr>` : "";
  const digits = signature.whatsapp.replace(/\D/g, "");
  const signatureHtml = `
    <p style="margin:8px 0 12px;">${en ? "Best regards," : "Cordialement,"}</p>
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 8px;"><tr><td style="border-left:3px solid #C8102E;padding:2px 0 2px 14px;">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr><td style="font-size:15px;line-height:21px;font-weight:700;">${esc(signature.name || (en ? `The ${signature.company} team` : `L'équipe ${signature.company}`))}</td></tr>
        ${signature.name ? `<tr><td style="font-size:13px;line-height:19px;font-weight:600;color:#C8102E;padding:0 0 4px;">${esc([signature.role, signature.company].filter(Boolean).join(" · "))}</td></tr>` : ""}
        ${signature.tagline ? `<tr><td class="rm-muted" style="font-size:12px;line-height:18px;color:#6E6E73;padding:0 0 8px;">${esc(signature.tagline)}</td></tr>` : ""}
        ${row("WhatsApp", signature.whatsapp, digits.length >= 8 ? `https://wa.me/${digits}` : undefined)}
        ${row(en ? "Email" : "E-mail", signature.email, signature.email ? `mailto:${signature.email}` : undefined)}
        ${row(en ? "Website" : "Site", signature.website.replace(/^https?:\/\//, ""), signature.website || undefined)}
        ${row(en ? "Address" : "Adresse", signature.address)}
      </table>
    </td></tr></table>`;
  return wrapper(`
    ${paragraphs}
    ${ctaUrl ? button(ctaUrl, ctaLabel || (en ? `Open ${signature.company}` : `Ouvrir ${signature.company}`)) : ""}
    ${signatureHtml}
    <p class="rm-muted" style="margin-top:16px;font-size:12px;color:#6E6E73;">${en ? `You are receiving this message because you have a ${esc(signature.company)} account. Reply “STOP” to stop receiving this type of message.` : `Vous recevez ce message parce que vous avez un compte ${esc(signature.company)}. Répondez « STOP » pour ne plus recevoir ce type de message.`}</p>
  `);
}
