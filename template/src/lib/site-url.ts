import { site } from '@/config/site'

/**
 * Adresse publique du site, utilisée pour les liens de retour et de rappel (webhooks) envoyés aux
 * passerelles de paiement. Elle ne vient JAMAIS de l'en-tête « Origin » de la requête : un client
 * malveillant pourrait y mettre son propre domaine, et la passerelle enverrait alors le rappel
 * (avec le secret du webhook) chez lui.
 */
export function publicOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || site.url
  const origin = configured.replace(/\/$/, '')
  return origin.includes('localhost') ? origin.replace('localhost', '127.0.0.1') : origin
}
