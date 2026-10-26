// Message du coach personnalisé pour un client : {prenom} et {lien} remplacés.
// Le même calcul sert à l'aperçu (admin, navigateur) et à l'envoi (serveur) : ce qu'on voit est ce qui part.

export function fillCoachMessage(template: string, firstName: string | null, link: string): string {
  return template
    .replaceAll('{prenom}', firstName || '')
    .replaceAll('{lien}', link)
    .replace(/[ \t]+,/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** Lien WhatsApp avec le message pré-rempli (envoi manuel : pas d'API WhatsApp). Null si le numéro est trop court. */
export function whatsappMessageLink(phone: string | null, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null
}
