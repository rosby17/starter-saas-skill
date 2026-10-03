// ORCHESTRATION DES PAIEMENTS (même schéma que iziVoice).
//
// Le client choisit un TYPE de paiement (mobile money, carte, PayPal), jamais une
// passerelle. L'administrateur choisit, pour chaque type, UNE passerelle active
// (page /admin/payment-providers) ; le checkout lit ce réglage côté serveur.
// Changer de passerelle ne demande donc aucune modification du site.
//
// Ajouter une passerelle : 1) un fichier dans gateways/ qui implémente PaymentGateway,
// 2) l'enregistrer dans gateways/index.ts, 3) la lister ci-dessous dans les catégories
// où elle marche, 4) une route webhook ou la vérification dans verify/ si besoin.

export type PaymentCategoryId = 'mobile_money' | 'card' | 'paypal' | 'crypto'

export const PAYMENT_CATEGORIES: Array<{ id: PaymentCategoryId; label: string; description: string }> = [
  { id: 'mobile_money', label: 'Mobile Money', description: 'Orange Money, MTN MoMo, Wave, etc.' },
  { id: 'card', label: 'Carte bancaire', description: 'Visa / Mastercard' },
  { id: 'paypal', label: 'PayPal', description: 'Paiement via un compte PayPal' },
  { id: 'crypto', label: 'Crypto (Binance Pay)', description: 'Paiement manuel, validé par un administrateur' },
]

// Passerelles disponibles par catégorie (celles qui ont un adaptateur dans gateways/).
export const PAYMENT_PROVIDERS: Record<PaymentCategoryId, Array<{ id: string; label: string }>> = {
  mobile_money: [
    { id: 'maketou', label: 'Maketou' },
    { id: 'taramoney', label: 'Tara Money' },
    { id: 'warappay', label: 'Warappay' },
    { id: 'geniuspay', label: 'GeniusPay' },
  ],
  // Warappay accepte aussi la carte et PayPal ; K-Pay ne fait que la carte (facturée en USD).
  card: [
    { id: 'taramoney', label: 'Tara Money' },
    { id: 'warappay', label: 'Warappay' },
    { id: 'kpay', label: 'K-Pay' },
    { id: 'geniuspay', label: 'GeniusPay' },
  ],
  paypal: [
    { id: 'taramoney', label: 'Tara Money' },
    { id: 'warappay', label: 'Warappay' },
  ],
  crypto: [{ id: 'binance', label: 'Binance Pay (manuel)' }],
}

// Un seul fournisseur actif par catégorie, jamais deux en même temps : le client
// doit être redirigé vers UNE page de paiement.
export const DEFAULT_ACTIVE_PROVIDER: Record<PaymentCategoryId, string> = {
  mobile_money: 'maketou',
  card: 'taramoney',
  paypal: 'taramoney',
  crypto: 'binance',
}

export function isKnownCategory(value: string): value is PaymentCategoryId {
  return PAYMENT_CATEGORIES.some((category) => category.id === value)
}

export function isKnownProvider(category: PaymentCategoryId, providerId: string): boolean {
  return PAYMENT_PROVIDERS[category]?.some((provider) => provider.id === providerId) ?? false
}
