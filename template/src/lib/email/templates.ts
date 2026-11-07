/**
 * E-mails transactionnels. Tous passent par emailLayout() (src/lib/email/layout.ts) : en-tête sombre avec le logo sur une
 * pastille de marque, titre, carte de contenu, pied de page en trois parties (aide, liens du site, mentions et raison de l'envoi).
 * Tout texte inséré passe par esc() : un nom ou un titre ne doit jamais injecter de HTML.
 */

import { site } from "@/config/site";
import { BRAND, INK, MUTED, emailButton, emailLayout, emailPanel, emailTag, esc } from "@/lib/email/layout";

export { esc };

const APP_NAME = site.name;
const ACCOUNT_REASON = `Tu reçois cet e-mail parce que tu as un compte ${APP_NAME}.`;

const p = (html: string) => `<p style="margin:0 0 14px">${html}</p>`;
const small = (html: string) => `<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:${MUTED}">${html}</p>`;

const linkNote = (href: string) =>
  small(`Le bouton ne marche pas ? Copie ce lien dans ton navigateur :<br><span style="word-break:break-all;color:${INK}">${esc(href)}</span>`) +
  small("Ce lien te connecte directement : ne le transfère à personne. Il expire au bout d'une heure ; tu peux en redemander un à tout moment sur la page Connexion.");

/** Accès livré après un paiement, un accès donné par l'admin ou un import : l'e-mail de bienvenue. */
export function accessReadyTemplate({ name, products, loginUrl, amount, invoice }: { name?: string | null; products: string[]; loginUrl: string; amount?: string | null; invoice?: string | null }): string {
  const list = products.map((x) => `<li style="margin:4px 0;"><strong>${esc(x)}</strong></li>`).join("");
  return emailLayout({
    eyebrow: amount ? "Paiement confirmé" : "Accès ouvert",
    title: `Bienvenue${name ? ` ${name}` : ""}, ton accès est prêt`,
    preheader: "Ton accès est prêt : connecte-toi en un clic.",
    reason: `Tu reçois cet e-mail parce qu'un accès vient d'être ouvert sur ton compte ${APP_NAME}.`,
    body: `
      ${p(`${amount ? `Ton paiement de <strong>${esc(amount)}</strong> est confirmé. ` : ""}Voici ce qui t'attend :`)}
      ${emailPanel(`<ul style="margin:0;padding-left:18px;">${list}</ul>`)}
      ${p(`<br>En entrant, quelques petites questions préparent <strong>ton</strong> parcours. Ensuite, tu avances à ton rythme.`)}
      ${emailButton(loginUrl, "Ouvrir mon espace")}
      ${invoice ? small(`Ta facture <strong>${esc(invoice)}</strong> est jointe à cet e-mail (PDF). Tu la retrouves aussi dans « Factures ».`) : ""}
      ${linkNote(loginUrl)}`,
  });
}

/** Réservation (précommande) confirmée : pas encore d'accès, la place est gardée. */
export function reservationTemplate({ name, product, amount, invoice, loginUrl }: { name?: string | null; product: string; amount?: string | null; invoice?: string | null; loginUrl: string }): string {
  return emailLayout({
    eyebrow: "Réservation confirmée",
    title: `Ta place est réservée${name ? `, ${name}` : ""}`,
    preheader: `Tu es sur la liste d'attente de ${product}.`,
    reason: `Tu reçois cet e-mail parce que tu as réservé une place sur ${APP_NAME}.`,
    body: `
      ${p(`${amount ? `Ton paiement de <strong>${esc(amount)}</strong> est confirmé. ` : ""}Tu es sur la liste d'attente de <strong>${esc(product)}</strong>.`)}
      ${p("Dès la sortie, tu es prévenu en premier, avec le prix réservé, et ton accès s'ouvre tout de suite.")}
      ${emailButton(loginUrl, "Voir ma réservation")}
      ${invoice ? small(`Ta facture <strong>${esc(invoice)}</strong> est jointe à cet e-mail (PDF).`) : ""}
      ${linkNote(loginUrl)}`,
  });
}

/** Nouveauté d'une formation (nouveau module, nouvelle leçon) envoyée aux élèves. */
export function courseUpdateTemplate({ name, title, body, url }: { name?: string | null; title: string; body?: string | null; url: string }): string {
  return emailLayout({
    eyebrow: "Nouveauté",
    title,
    preheader: body || "C'est déjà dans ton espace.",
    reason: `Tu reçois cet e-mail parce que tu suis une formation sur ${APP_NAME}.`,
    body: `
      ${p(`Bonjour${name ? ` ${esc(name)}` : ""},`)}
      ${body ? `<p style="margin:0 0 14px;white-space:pre-line;">${esc(body)}</p>` : ""}
      ${p("C'est déjà dans ton espace, à la suite de ton parcours.")}
      ${emailButton(url, "Voir la nouveauté")}`,
  });
}

/** Lien de connexion demandé depuis la page Connexion. */
export function loginLinkTemplate({ loginUrl }: { loginUrl: string }): string {
  return emailLayout({
    eyebrow: "Connexion",
    title: "Ton lien de connexion",
    preheader: "Un clic et tu retrouves ton espace.",
    reason: `Tu reçois cet e-mail parce qu'un lien de connexion a été demandé pour ton compte ${APP_NAME}. Tu n'as rien demandé ? Ignore-le simplement.`,
    body: `
      ${p("Voici ton lien pour te connecter à ton espace et retrouver tes achats.")}
      ${emailButton(loginUrl, "Me connecter")}
      ${linkNote(loginUrl)}`,
  });
}

/** Demande enregistrée (accompagnement, service sur devis, monétisation). */
export function requestReceivedTemplate({ name, kind, loginUrl }: { name?: string | null; kind: string; loginUrl: string }): string {
  return emailLayout({
    eyebrow: "Demande reçue",
    title: "Ta demande est bien enregistrée",
    preheader: `${kind} : réponse rapide, suivi dans ton espace.`,
    reason: `Tu reçois cet e-mail parce que tu as envoyé une demande sur ${APP_NAME}.`,
    body: `
      ${p(`Bonjour${name ? ` ${esc(name)}` : ""},`)}
      <p style="margin:0 0 14px">${emailTag(kind)}</p>
      ${p("Nous te répondons rapidement, et tu peux suivre son avancement dans ton espace.")}
      ${emailButton(loginUrl, "Suivre ma demande")}
      ${linkNote(loginUrl)}`,
  });
}

/** Réponse ou changement de statut d'une demande. */
export function requestUpdateTemplate({ name, kind, status, reply, url }: { name?: string | null; kind: string; status: string; reply?: string | null; url: string }): string {
  return emailLayout({
    eyebrow: "Suivi de ta demande",
    title: `Ta demande est maintenant : ${status}`,
    preheader: reply ? reply.slice(0, 90) : `${kind} : ${status}`,
    reason: `Tu reçois cet e-mail parce que tu as envoyé une demande sur ${APP_NAME}.`,
    body: `
      ${p(`Bonjour${name ? ` ${esc(name)}` : ""},`)}
      <p style="margin:0 0 14px">${emailTag(kind)}</p>
      ${reply ? emailPanel(`<span style="white-space:pre-line">${esc(reply)}</span>`) : ""}
      ${emailButton(url, "Voir ma demande")}`,
  });
}

/** Alerte envoyée à l'administrateur (nouvelle vente, nouvelle demande). */
export function adminAlertTemplate({ title, lines, url }: { title: string; lines: string[]; url: string }): string {
  return emailLayout({
    eyebrow: "Administration",
    title,
    preheader: lines[0] ?? title,
    reason: `Tu reçois cet e-mail parce que ton adresse est celle des alertes de l'administration de ${APP_NAME}.`,
    body: `
      ${emailPanel(lines.map((l) => esc(l)).join("<br>"))}
      ${emailButton(url, "Ouvrir l'administration")}`,
  });
}

export function genericNotificationTemplate({ title, message }: { title: string; message: string }): string {
  return emailLayout({
    title,
    preheader: message,
    reason: ACCOUNT_REASON,
    body: `<p style="margin:0;white-space:pre-line">${esc(message)}</p>`,
  });
}

/** Code de la validation en deux étapes (par e-mail). Jamais le code dans le sujet. */
export function twoFactorCodeTemplate({ code, purpose }: { code: string; purpose: "login" | "enable" }): string {
  return emailLayout({
    eyebrow: "Sécurité",
    title: purpose === "enable" ? "Ton code d'activation" : "Ton code de connexion",
    preheader: "Valable 10 minutes, une seule fois.",
    reason: `Tu reçois cet e-mail parce qu'un code a été demandé pour ton compte ${APP_NAME}.`,
    body: `
      ${p(purpose === "enable" ? "Voici ton code pour activer la validation en deux étapes par e-mail :" : "Voici ton code de connexion :")}
      <p style="margin:18px 0;font-size:32px;font-weight:800;letter-spacing:8px;color:${INK}">${esc(code)}</p>
      ${p("Il est valable 10 minutes et ne sert qu'une fois.")}
      ${small("Tu n'as rien demandé ? Ignore cet e-mail et change ton mot de passe : quelqu'un le connaît peut-être.")}`,
  });
}

export const TWO_FACTOR_SUBJECT = `Ton code de connexion ${APP_NAME}`;

/** Compte suspendu : le motif choisi par l'administrateur (texte préétabli) et comment nous joindre. */
export function accountSuspendedTemplate({ reason }: { reason: string }): string {
  return emailLayout({
    eyebrow: "Ton compte",
    title: `Ton compte ${APP_NAME} a été suspendu`,
    preheader: "Le motif et comment demander un nouvel examen.",
    reason: ACCOUNT_REASON,
    body: `
      ${p("Bonjour,")}
      ${p("Nous avons suspendu ton compte pour la raison suivante :")}
      ${emailPanel(esc(reason))}
      ${p(`<br>Si tu penses qu'il s'agit d'une erreur, réponds simplement à cet e-mail en nous expliquant ta situation (site web, activité, page professionnelle) : nous réexaminons chaque demande.`)}
      ${small("Aucune donnée n'est supprimée pendant l'examen de ta demande.")}`,
  });
}

/** Crédits ajoutés (ou repris) par l'administrateur : montant, justification, nouveau solde. */
export function creditsAdjustedTemplate({ name, amount, note, balance, url }: { name?: string | null; amount: number; note?: string | null; balance?: number | null; url: string }): string {
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const added = amount > 0;
  return emailLayout({
    eyebrow: "Crédits",
    title: added ? `${fmt(amount)} crédits ajoutés à ton compte` : "Ton solde de crédits a été ajusté",
    preheader: balance != null ? `Nouveau solde : ${fmt(Math.max(0, balance))} crédits.` : "",
    reason: ACCOUNT_REASON,
    body: `
      ${p(`Bonjour${name ? ` ${esc(name)}` : ""},`)}
      ${p(added ? `Nous venons d'ajouter <strong>${fmt(amount)} crédits</strong> à ton compte.` : `Nous avons ajusté ton solde de <strong>${fmt(amount)} crédits</strong>.`)}
      ${note ? emailPanel(`<strong>Motif :</strong> ${esc(note)}`) : ""}
      ${balance != null ? p(`<br>Nouveau solde : <strong>${fmt(Math.max(0, balance))} crédits</strong>.`) : ""}
      ${emailButton(url, "Voir mes crédits")}`,
  });
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
  const linkify = (line: string) => esc(line).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}" style="color:${INK};text-decoration:underline;">${url}</a>`);
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  while (blocks.length > 1 && blocks[blocks.length - 1].length < 160 && /^(bien\s+)?cordialement|^best\s+regards|^kind\s+regards|^regards|^bien\s+à\s+vous|^l[’']équipe\b|^the\s+\S+\s+team/i.test(blocks[blocks.length - 1])) blocks.pop();
  const paragraphs = blocks.map((b) => `<p style="margin:0 0 16px;">${b.split("\n").map(linkify).join("<br>")}</p>`).join("");
  const row = (label: string, value: string, href?: string) =>
    value ? `<tr><td style="font-size:13px;line-height:21px;"><span style="color:${BRAND};font-weight:600;">${esc(label)}</span>&nbsp;&nbsp;${href ? `<a href="${esc(href)}" style="color:${INK};text-decoration:none;">${esc(value)}</a>` : esc(value)}</td></tr>` : "";
  const digits = signature.whatsapp.replace(/\D/g, "");
  const signatureHtml = `
    <p style="margin:8px 0 12px;">${en ? "Best regards," : "Cordialement,"}</p>
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 8px;"><tr><td style="border-left:3px solid ${BRAND};padding:2px 0 2px 14px;">
      <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr><td style="font-size:15px;line-height:21px;font-weight:700;">${esc(signature.name || (en ? `The ${signature.company} team` : `L'équipe ${signature.company}`))}</td></tr>
        ${signature.name ? `<tr><td style="font-size:13px;line-height:19px;font-weight:600;color:${BRAND};padding:0 0 4px;">${esc([signature.role, signature.company].filter(Boolean).join(" · "))}</td></tr>` : ""}
        ${signature.tagline ? `<tr><td style="font-size:12px;line-height:18px;color:${MUTED};padding:0 0 8px;">${esc(signature.tagline)}</td></tr>` : ""}
        ${row("WhatsApp", signature.whatsapp, digits.length >= 8 ? `https://wa.me/${digits}` : undefined)}
        ${row(en ? "Email" : "E-mail", signature.email, signature.email ? `mailto:${signature.email}` : undefined)}
        ${row(en ? "Website" : "Site", signature.website.replace(/^https?:\/\//, ""), signature.website || undefined)}
        ${row(en ? "Address" : "Adresse", signature.address)}
      </table>
    </td></tr></table>`;
  const reason = en
    ? `You are receiving this message because you have a ${signature.company} account. Reply “STOP” to stop receiving this type of message.`
    : `Vous recevez ce message parce que vous avez un compte ${signature.company}. Répondez « STOP » pour ne plus recevoir ce type de message.`;
  return emailLayout({
    preheader: blocks[0]?.slice(0, 90) ?? "",
    reason,
    body: `
    ${paragraphs}
    ${ctaUrl ? emailButton(ctaUrl, ctaLabel || (en ? `Open ${signature.company}` : `Ouvrir ${signature.company}`)) : ""}
    ${signatureHtml}`,
  });
}
