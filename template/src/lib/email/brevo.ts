/**
 * Envoi des e-mails par Brevo (API transactionnelle v3).
 *
 * `sendEmailDetailed` ATTEND la réponse de Brevo et rend la vraie raison d'un échec (clé refusée, expéditeur non
 * vérifié, quota…) : à utiliser quand la personne attend l'e-mail (code de connexion, exemple de l'admin).
 * `sendEmail` reste la version courte (vrai / faux) pour les envois dont on n'affiche pas le détail.
 * Chaque envoi est noté dans le journal `email_log` (Administration › E-mails), JAMAIS son contenu :
 * un e-mail peut porter un code. Ne jamais mettre un code ou un secret dans le SUJET (les sujets sont journalisés).
 */

import { serviceClient } from "@/lib/auth/service-client";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface EmailParams {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  replyTo?: { email: string; name?: string };
  /**
   * Priorité (défaut « normal »). Les e-mails « low » peuvent être sautés pour ménager un petit quota
   * quotidien (ex. 300/jour de l'offre gratuite de Brevo) avec DISABLE_LOW_PRIORITY_EMAILS=true.
   */
  priority?: "critical" | "high" | "normal" | "low";
  /** Nom du modèle, pour le journal (ex. « two-factor-code »). */
  template?: string;
  /** Envoi d'exemple depuis l'administration (marqué comme tel dans le journal). */
  example?: boolean;
}

export type EmailResult = {
  ok: boolean;
  status: "sent" | "failed" | "skipped";
  /** Code HTTP de Brevo (absent si le fournisseur n'a pas répondu). */
  providerStatus?: number;
  /** Explication en français, prête à afficher. */
  message: string;
  /** Réponse brute du fournisseur en cas d'échec (journalisée). */
  providerResponse?: string;
  messageId?: string;
};

// Traduit la réponse de Brevo en une phrase utile à l'administrateur.
function explainBrevoError(status: number, body: string): string {
  let code = "";
  let detail = body;
  try {
    const json = JSON.parse(body) as { code?: string; message?: string };
    code = json.code ?? "";
    detail = json.message ?? body;
  } catch {
    // réponse non JSON : on garde le texte brut
  }
  if (status === 401 || code === "unauthorized") return `Brevo refuse la clé API (${detail}). Vérifie BREVO_API_KEY dans Clés et intégrations.`;
  if (/sender/i.test(detail)) return `Brevo refuse l'expéditeur (${detail}). L'adresse BREVO_SENDER_EMAIL doit être un expéditeur vérifié dans Brevo.`;
  if (status === 402 || /credit|quota/i.test(detail)) return `Brevo : quota ou crédits d'envoi épuisés (${detail}).`;
  if (status === 429) return `Brevo limite les envois pour l'instant (${detail}). Réessaie dans quelques minutes.`;
  if (status === 400) return `Brevo refuse l'e-mail : ${detail}`;
  return `Brevo a répondu ${status} : ${detail}`;
}

async function logEmail(params: EmailParams, result: EmailResult) {
  try {
    const { error } = await serviceClient().from("email_log").insert({
      to_email: params.to.email,
      subject: params.subject.slice(0, 300),
      template: params.template ?? null,
      status: result.status,
      provider_status: result.providerStatus ?? null,
      provider_response: result.ok ? null : (result.providerResponse ?? result.message).slice(0, 2000),
      message_id: result.messageId ?? null,
      is_example: !!params.example,
    });
    if (error) console.error("[Brevo] Journal des e-mails illisible (migration email_log appliquée ?) :", error.message);
  } catch (err) {
    console.error("[Brevo] Journal des e-mails impossible :", err);
  }
}

export async function sendEmailDetailed(params: EmailParams): Promise<EmailResult> {
  const { to, subject, html, replyTo, priority = "normal" } = params;
  let result: EmailResult;
  if (priority === "low" && process.env.DISABLE_LOW_PRIORITY_EMAILS === "true") {
    result = { ok: true, status: "skipped", message: "E-mail peu important sauté (DISABLE_LOW_PRIORITY_EMAILS)." };
  } else if (!process.env.BREVO_API_KEY) {
    result = { ok: false, status: "failed", message: "Aucune clé Brevo : ajoute BREVO_API_KEY dans Administration › Clés et intégrations." };
  } else {
    try {
      const res = await fetch(BREVO_API_URL, {
        signal: AbortSignal.timeout(15_000),
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json", "api-key": process.env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: {
            email: process.env.BREVO_SENDER_EMAIL || "hello@yoursaas.app",
            name: process.env.BREVO_SENDER_NAME || "{{APP_NAME}}",
          },
          to: [{ email: to.email, name: to.name || to.email }],
          subject,
          htmlContent: html,
          ...(replyTo ? { replyTo } : {}),
        }),
      });
      const body = await res.text();
      if (res.ok) {
        let messageId: string | undefined;
        try { messageId = (JSON.parse(body) as { messageId?: string }).messageId; } catch { /* pas d'identifiant */ }
        result = { ok: true, status: "sent", providerStatus: res.status, message: "Envoyé.", messageId };
      } else {
        console.error("[Brevo] Envoi refusé :", res.status, body);
        result = { ok: false, status: "failed", providerStatus: res.status, message: explainBrevoError(res.status, body), providerResponse: body };
      }
    } catch (err) {
      const timeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      console.error("[Brevo] Erreur réseau :", err);
      result = {
        ok: false,
        status: "failed",
        message: timeout ? "Brevo n'a pas répondu en 15 secondes. Réessaie dans un instant." : `Brevo injoignable : ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
  await logEmail(params, result);
  return result;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  return (await sendEmailDetailed(params)).ok;
}
