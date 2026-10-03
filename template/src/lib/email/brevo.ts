/**
 * Brevo (Sendinblue) Email Service
 * Uses the Brevo Transactional Email API v3
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface EmailParams {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  replyTo?: { email: string; name?: string };
  /**
   * Priority level (default: "normal"). "low" priority emails can be
   * skipped to conserve a limited daily quota (e.g. Brevo's free 300/day tier).
   */
  priority?: "critical" | "high" | "normal" | "low";
}

export async function sendEmail({ to, subject, html, replyTo, priority = "normal" }: EmailParams): Promise<boolean> {
  if (priority === "low" && process.env.DISABLE_LOW_PRIORITY_EMAILS === "true") {
    console.log(`[Brevo] Quota optimization: Skipped low priority email to ${to.email} (${subject})`);
    return true;
  }
  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY!,
      },
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

    if (!res.ok) {
      const err = await res.text();
      console.error("[Brevo] Email send failed:", err);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Brevo] Network error:", err);
    return false;
  }
}
