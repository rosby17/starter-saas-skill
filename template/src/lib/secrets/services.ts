// SERVICES affichés en tuiles dans /admin/keys : chaque tuile regroupe les clés d'un même service
// (déclarées dans catalog.ts). Logo officiel dans public/logos/services/ (pastille blanche 48×48) ;
// un service sans logo officiel a un pictogramme SVG clair, jamais une initiale dans un carré coloré.
//
// Ajouter un service : ses clés dans catalog.ts, puis une ligne ici (les clés oubliées tombent dans « Autres réglages »).

export type ServiceSection = 'Essentiel' | 'Paiement' | 'Connexion' | 'Mise en ligne'

export type ServiceDefinition = {
  id: string
  name: string
  section: ServiceSection
  /** Une phrase : ce que le service apporte au site. */
  description: string
  /** Fichier dans public/ (logo officiel ou pictogramme). */
  logo: string
  /** Où trouver les clés chez le fournisseur. */
  where?: { label: string; url: string }
  /** Noms des clés (catalog.ts), dans l'ordre d'affichage. */
  keys: string[]
}

export const SERVICE_SECTIONS: ServiceSection[] = ['Essentiel', 'Paiement', 'Connexion', 'Mise en ligne']

export const SERVICES: ServiceDefinition[] = [
  { id: 'brevo', name: 'Brevo', section: 'Essentiel', logo: '/logos/services/brevo.png',
    description: 'Envoie les e-mails du site : reçus, codes de connexion, notifications.',
    where: { label: 'Brevo › SMTP & API', url: 'https://app.brevo.com/settings/keys/api' },
    keys: ['BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME', 'BREVO_SMTP_LOGIN', 'BREVO_SMTP_KEY'] },
  { id: 'cron', name: 'Tâches planifiées', section: 'Essentiel', logo: '/logos/services/taches-planifiees.svg',
    description: 'Protège les tâches automatiques (rattrapage des paiements, taux de change, ménage).',
    keys: ['CRON_SECRET'] },

  { id: 'maketou', name: 'Maketou', section: 'Paiement', logo: '/logos/services/maketou.svg',
    description: 'Paiements Mobile Money (Orange Money, MTN MoMo, Wave…).',
    where: { label: 'Tableau de bord Maketou', url: 'https://maketou.net' },
    keys: ['MAKETOU_API_KEY', 'MAKETOU_PRODUCT_ID'] },
  { id: 'taramoney', name: 'Tara Money', section: 'Paiement', logo: '/logos/services/taramoney.png',
    description: 'Mobile Money, carte bancaire et PayPal.',
    where: { label: 'Tableau de bord Tara Money', url: 'https://www.dklo.co' },
    keys: ['TARA_API_KEY', 'TARA_BUSINESS_ID', 'TARA_WEBHOOK_SECRET'] },
  { id: 'warappay', name: 'Warappay', section: 'Paiement', logo: '/logos/services/warappay.png',
    description: 'Mobile Money, carte bancaire et PayPal, en XOF ou XAF.',
    where: { label: 'Tableau de bord Warappay', url: 'https://warappay.com' },
    keys: ['WARAPPAY_API_KEY', 'WARAPPAY_PRODUCT_CODE', 'WARAPPAY_WEBHOOK_SECRET', 'WARAPPAY_CURRENCY'] },
  { id: 'geniuspay', name: 'GeniusPay', section: 'Paiement', logo: '/logos/services/geniuspay.svg',
    description: 'Mobile Money et carte bancaire.',
    where: { label: 'Tableau de bord GeniusPay', url: 'https://geniuspay.ci' },
    keys: ['GENIUSPAY_API_KEY', 'GENIUSPAY_API_SECRET', 'GENIUSPAY_WEBHOOK_SECRET'] },
  { id: 'kpay', name: 'K-Pay', section: 'Paiement', logo: '/logos/services/kpay.png',
    description: 'Carte bancaire, facturée en dollars.',
    where: { label: 'Tableau de bord K-Pay', url: 'https://admin.kpay.site' },
    keys: ['KPAY_API_KEY', 'KPAY_SECRET_KEY', 'KPAY_WEBHOOK_SECRET'] },
  { id: 'binance', name: 'Binance Pay', section: 'Paiement', logo: '/logos/services/binance.png',
    description: 'Paiement en crypto, validé à la main dans Commandes.',
    where: { label: 'Application Binance › Pay › mon identifiant Pay', url: 'https://www.binance.com/fr/pay' },
    keys: ['BINANCE_PAY_ID'] },

  { id: 'google', name: 'Connexion avec Google', section: 'Connexion', logo: '/logos/services/google.svg',
    description: 'Ajoute « Continuer avec Google » sur la connexion et l’inscription.',
    where: { label: 'Google Cloud › Identifiants', url: 'https://console.cloud.google.com/apis/credentials' },
    keys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },

  { id: 'github', name: 'GitHub', section: 'Mise en ligne', logo: '/logos/services/github.svg',
    description: 'Garde le code du site dans un dépôt privé pour la mise en ligne.',
    where: { label: 'GitHub › Jetons', url: 'https://github.com/settings/tokens' },
    keys: ['GITHUB_TOKEN'] },
  { id: 'coolify', name: 'Coolify', section: 'Mise en ligne', logo: '/logos/services/coolify.svg',
    description: 'Installe et fait tourner le site et sa base sur ton serveur.',
    keys: ['COOLIFY_URL', 'COOLIFY_API_TOKEN'] },
  { id: 'hostinger', name: 'Hostinger', section: 'Mise en ligne', logo: '/logos/services/hostinger.svg',
    description: 'Règle le nom de domaine (DNS) s’il est chez Hostinger.',
    where: { label: 'hPanel › Profil › API', url: 'https://hpanel.hostinger.com/profile/api' },
    keys: ['HOSTINGER_API_TOKEN'] },
  { id: 'cloudflare', name: 'Cloudflare', section: 'Mise en ligne', logo: '/logos/services/cloudflare.svg',
    description: 'Règle le nom de domaine (DNS) s’il est chez Cloudflare.',
    where: { label: 'Cloudflare › Jetons API', url: 'https://dash.cloudflare.com/profile/api-tokens' },
    keys: ['CLOUDFLARE_API_TOKEN'] },
]

/** Service fourre-tout pour une clé du catalogue qu'aucun service ne liste encore. */
export const OTHER_SERVICE: ServiceDefinition = {
  id: 'autres', name: 'Autres réglages', section: 'Essentiel', logo: '/logos/services/cle.svg',
  description: 'Clés déclarées dans le catalogue sans service attitré.', keys: [],
}
