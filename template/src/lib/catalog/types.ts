// Catalogue : types et calcul du prix, utilisables côté navigateur ET serveur (aucun secret ici).

export type Category = 'formation' | 'abonnement' | 'accompagnement' | 'logiciel' | 'service' | 'credits'
export type Billing = 'one_time' | 'monthly'
export type RequestKind = 'coaching' | 'accompagnement' | 'projet' | 'design' | 'audit' | 'autre'

export type Product = {
  id: string
  slug: string
  category: Category
  title: string
  subtitle: string | null
  description: string | null
  features: string[]
  price_fcfa: number | null
  compare_at_fcfa: number | null
  promo_price_fcfa: number | null
  promo_ends_at: string | null
  image: string | null
  sales_url: string | null
  external_url: string | null
  request_kind: RequestKind | null
  includes: string[]
  published: boolean
  position: number
  /** one_time = achat à vie ; monthly = abonnement (accès qui expire, renouvelable) */
  billing: Billing
  period_days: number
  /** Abonnement « Rester à jour » : nouveautés de toutes les formations possédées (n'ouvre pas d'autres cours) */
  covers_all: boolean
  /** Abonnement aux mises à jour d'UN cours (slug du cours) */
  updates_for: string | null
  /** Pas encore prêt : vendu en PRÉCOMMANDE (réservation de 10 %, puis 60 % à la sortie) */
  preorder: boolean
  /** Pack de crédits (catégorie « credits ») : crédits versés au paiement et leur durée de validité (null = sans fin) */
  credits: number
  credits_validity_days: number | null
}

export const PRODUCT_COLUMNS =
  'id, slug, category, title, subtitle, description, features, price_fcfa, compare_at_fcfa, promo_price_fcfa, promo_ends_at, image, sales_url, external_url, request_kind, includes, published, position, billing, period_days, covers_all, updates_for, preorder, credits, credits_validity_days'

export const CATEGORIES: Array<{ id: Category; label: string; intro: string }> = [
  { id: 'formation', label: 'Formations', intro: 'Des cours sur des projets réels : tu regardes, tu refais, tu poses tes questions. Accès à vie.' },
  { id: 'abonnement', label: 'Abonnements', intro: 'Reçois chaque nouveauté dès sa sortie. Sans engagement.' },
  { id: 'accompagnement', label: 'Accompagnements', intro: 'La formation, plus un accompagnement sur TON projet, en direct.' },
  { id: 'credits', label: 'Crédits', intro: 'Recharge ton solde et paie seulement ce que tu utilises.' },
  { id: 'logiciel', label: 'Produits et logiciels', intro: 'Des outils prêts à l’emploi.' },
  { id: 'service', label: 'Services', intro: 'On le fait pour toi.' },
]

export const REQUEST_KINDS: Record<RequestKind, string> = {
  coaching: 'Coaching',
  accompagnement: 'Accompagnement',
  projet: 'Projet sur mesure',
  design: 'Design graphique',
  audit: 'Audit',
  autre: 'Autre demande',
}

/** Promo active à l'instant `now` (null sinon). */
export function activePromo(p: Pick<Product, 'promo_price_fcfa' | 'promo_ends_at'>, now = Date.now()) {
  if (p.promo_price_fcfa == null) return null
  const endsAt = p.promo_ends_at ? new Date(p.promo_ends_at).getTime() : Infinity
  return now < endsAt ? { priceFcfa: p.promo_price_fcfa, endsAt: Number.isFinite(endsAt) ? endsAt : null } : null
}

/** Prix à payer maintenant, en FCFA. null = sur demande (pas de paiement en ligne). */
export function currentPrice(p: Pick<Product, 'price_fcfa' | 'promo_price_fcfa' | 'promo_ends_at'>, now = Date.now()): number | null {
  if (p.price_fcfa == null) return null
  return activePromo(p, now)?.priceFcfa ?? p.price_fcfa
}

/** Ce produit se paie-t-il en ligne ? (sinon : lien externe, ou demande / devis) */
export const isBuyable = (p: Product) => !p.external_url && p.price_fcfa != null && p.price_fcfa > 0

export const productHref = (p: Pick<Product, 'slug' | 'sales_url' | 'external_url'>) => p.sales_url || `/boutique/${p.slug}`

export const formatFcfa = (n: number) => `${n.toLocaleString('fr-FR').replace(/ | /g, ' ')} FCFA`

export const isMonthly = (p: Pick<Product, 'billing'>) => p.billing === 'monthly'

/** « /mois » après le prix d'un abonnement (vide pour un achat unique). */
export const pricePeriod = (p: Pick<Product, 'billing' | 'period_days'>) =>
  p.billing === 'monthly' ? (p.period_days === 30 ? ' / mois' : ` / ${p.period_days} jours`) : ''

// PRÉCOMMANDE : on réserve sa place avec 10 % du prix ; à la sortie, on termine avec 60 %
// au lieu de 100 % (70 % au total). Montants arrondis à la centaine de FCFA.
export const PREORDER_DEPOSIT = 0.1
export const PREORDER_BALANCE = 0.6
const round100 = (x: number) => Math.max(100, Math.round(x / 100) * 100)
export const preorderDeposit = (price: number) => round100(price * PREORDER_DEPOSIT)
export const preorderBalance = (price: number) => round100(price * PREORDER_BALANCE)

/** Bouton d'achat : on S'INSCRIT à une formation ou à un accompagnement (l'inscription crée l'espace de l'élève). */
export function enrollLabel(product: Pick<Product, 'category' | 'billing' | 'preorder'>): string {
  if (product.billing === 'monthly') return "S'abonner · renouveler"
  if (product.preorder) return 'Réserver ma place · 10 %'
  if (product.category === 'formation') return "S'inscrire à la formation"
  if (product.category === 'accompagnement') return "S'inscrire à l'accompagnement"
  if (product.category === 'credits') return 'Acheter les crédits'
  return 'Commander'
}
