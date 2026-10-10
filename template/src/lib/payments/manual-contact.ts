import { whatsappLink } from '@/config/site'

/** Lien WhatsApp pré-rempli où le client envoie la capture d'un paiement manuel (Wave, Binance, USDT).
 *  Numéro : site.whatsapp (src/config/site.ts). Sans numéro, le bouton n'est pas affiché. */
export const manualPaymentWhatsapp = (message: string): string | undefined => whatsappLink(message) ?? undefined
