// Anti-spam sans clé ni service tiers : un champ « piège » invisible pour les
// humains (les robots remplissent tous les champs) + un délai minimal entre
// l'affichage du formulaire et l'envoi (un robot soumet en quelques ms).
// Complète la limite par IP (lib/rate-limit) des routes concernées.
export const HONEYPOT_FIELD = "company_website";
export const FORM_STARTED_AT_FIELD = "formStartedAt";
const MIN_FILL_MS = 2000;

/** Valeurs à joindre au corps de la requête, lues dans le formulaire envoyé. */
export function honeypotPayload(form: HTMLFormElement | null, startedAt: number): Record<string, string | number> {
  const field = form?.elements.namedItem(HONEYPOT_FIELD);
  const value = field instanceof HTMLInputElement ? field.value : "";
  return { [HONEYPOT_FIELD]: value, [FORM_STARTED_AT_FIELD]: startedAt };
}

/** Côté serveur : vrai si la requête vient très probablement d'un robot. */
export function isLikelyBot(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  const trap = record[HONEYPOT_FIELD];
  if (typeof trap === "string" && trap.trim() !== "") return true;
  const startedAt = Number(record[FORM_STARTED_AT_FIELD]);
  // Absent (ancien client, appel d'API) : on ne bloque pas sur ce seul critère.
  if (Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < MIN_FILL_MS) return true;
  return false;
}
