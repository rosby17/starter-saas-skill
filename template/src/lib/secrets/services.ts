// SERVICES affichés en tuiles dans /admin/keys : chaque tuile regroupe les clés d'un même service
// (déclarées dans catalog.ts). Logo officiel dans public/logos/services/ (pastille blanche) ;
// un service sans logo officiel a un pictogramme clair, jamais une initiale dans un carré coloré.

export type ServiceSection = 'Essentiel' | 'Paiement' | 'Connexion et IA' | 'Mise en ligne'

export type ServiceDefinition = {
  id: string
  name: string
  section: ServiceSection
  description: string
  logo: string
  where?: { label: string; url: string }
  keys: string[]
}

export const SERVICE_SECTIONS: ServiceSection[] = ['Essentiel', 'Paiement', 'Connexion et IA', 'Mise en ligne']

export const SERVICES: ServiceDefinition[] = [
  { id: 'brevo', name: 'Brevo', section: 'Essentiel', logo: '/logos/services/brevo.png',
    description: 'Envoie les e-mails du site : bienvenue, accès, liens de connexion, nouveautés, alertes de vente.',
    where: { label: 'Brevo › SMTP & API', url: 'https://app.brevo.com/settings/keys/api' },
    keys: ['BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'BREVO_SENDER_NAME', 'ADMIN_NOTIFY_EMAIL', 'BREVO_SMTP_LOGIN', 'BREVO_SMTP_KEY'] },
  { id: 'cron', name: 'Tâches planifiées', section: 'Essentiel', logo: '/logos/services/taches-planifiees.svg',
    description: 'Protège les tâches automatiques : rattrapage des paiements, annulation après 30 min, rappels d’abonnement.',
    keys: ['CRON_SECRET'] },

  { id: 'taramoney', name: 'Tara Money', section: 'Paiement', logo: '/logos/services/taramoney.png',
    description: 'Mobile Money, carte bancaire et PayPal.',
    keys: ['TARA_API_KEY', 'TARA_BUSINESS_ID', 'TARA_WEBHOOK_SECRET'] },
  { id: 'warappay', name: 'Warappay', section: 'Paiement', logo: '/logos/services/warappay.png',
    description: 'Mobile Money, carte bancaire et PayPal, en XOF ou XAF.',
    where: { label: 'Tableau de bord Warappay', url: 'https://warappay.com' },
    keys: ['WARAPPAY_API_KEY', 'WARAPPAY_PRODUCT_CODE', 'WARAPPAY_WEBHOOK_SECRET', 'WARAPPAY_CURRENCY'] },
  { id: 'maketou', name: 'Maketou', section: 'Paiement', logo: '/logos/services/cle.svg',
    description: 'Mobile Money en FCFA (Orange Money, MTN MoMo…). Sans webhook : chaque paiement est vérifié au retour du client et toutes les 15 minutes.',
    where: { label: 'Tableau de bord Maketou', url: 'https://maketou.net' },
    keys: ['MAKETOU_API_KEY', 'MAKETOU_PRODUCT_ID'] },
  { id: 'binance', name: 'Binance Pay', section: 'Paiement', logo: '/logos/services/binance.png',
    description: 'Paiement en crypto : le client paie sur ton identifiant, tu valides la commande à la main.',
    where: { label: 'Application Binance › Pay › mon identifiant Pay', url: 'https://www.binance.com/fr/pay' },
    keys: ['BINANCE_PAY_ID', 'BINANCE_PAY_NAME', 'USDT_TRC20_ADDRESS'] },
  { id: 'wave', name: 'Wave (manuel)', section: 'Paiement', logo: '/logos/services/cle.svg',
    description: 'Le client envoie le montant à ton numéro Wave puis la capture sur WhatsApp ; tu valides la commande à la main.',
    keys: ['WAVE_NUMBER', 'WAVE_NAME'] },
  { id: 'momo_direct', name: 'Mobile Money direct (manuel)', section: 'Paiement', logo: '/logos/services/cle.svg',
    description: 'Le client envoie le montant sur tes numéros Mobile Money (dépôt ou code marchand), depuis n’importe quel pays, puis la capture sur WhatsApp ; tu valides la commande à la main. Aussi modifiable dans Moyens de paiement › Coordonnées.',
    keys: ['MOMO_DIRECT_1_OPERATOR', 'MOMO_DIRECT_1_NUMBER', 'MOMO_DIRECT_1_USSD', 'MOMO_DIRECT_2_OPERATOR', 'MOMO_DIRECT_2_NUMBER', 'MOMO_DIRECT_2_USSD', 'MOMO_DIRECT_HOLDER', 'MOMO_DIRECT_COUNTRY'] },

  { id: 'google', name: 'Connexion avec Google', section: 'Connexion et IA', logo: '/logos/services/google.svg',
    description: 'Ajoute « Continuer avec Google » sur la connexion et l’inscription.',
    where: { label: 'Google Cloud › Identifiants', url: 'https://console.cloud.google.com/apis/credentials' },
    keys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
  { id: 'kie', name: 'kie.ai (Claude)', section: 'Connexion et IA', logo: '/logos/services/cle.svg',
    description: 'Analyse le questionnaire d’accueil et prépare le parcours personnalisé de chaque élève.',
    where: { label: 'kie.ai › API Key', url: 'https://kie.ai/api-key' },
    keys: ['KIE_API_KEY', 'KIE_API_KEY_2'] },
  { id: 'anthropic', name: 'Anthropic (Claude)', section: 'Connexion et IA', logo: '/logos/services/anthropic.svg',
    description: 'Le coach business : point du jour, questions libres, analyse des réponses des clients.',
    where: { label: 'Claude Console › API Keys', url: 'https://platform.claude.com/settings/keys' },
    keys: ['ANTHROPIC_API_KEY', 'COACH_MODEL', 'COACH_FALLBACK_MODEL'] },

  { id: 'github', name: 'GitHub', section: 'Mise en ligne', logo: '/logos/services/github.svg',
    description: 'Dépôt du code du site (mise en ligne automatique).', keys: ['GITHUB_TOKEN'] },
  { id: 'coolify', name: 'Coolify', section: 'Mise en ligne', logo: '/logos/services/coolify.svg',
    description: 'Le serveur qui héberge le site et la base de données.', keys: ['COOLIFY_URL', 'COOLIFY_API_TOKEN'] },
  { id: 'cloudflare', name: 'Cloudflare', section: 'Mise en ligne', logo: '/logos/services/cloudflare.svg',
    description: 'Nom de domaine et DNS.', keys: ['CLOUDFLARE_API_TOKEN'] },
  { id: 'hostinger', name: 'Hostinger', section: 'Mise en ligne', logo: '/logos/services/hostinger.svg',
    description: 'Ancien hébergeur (facultatif).', keys: ['HOSTINGER_API_TOKEN'] },
]

export const OTHER_SERVICE: ServiceDefinition = { id: 'autres', name: 'Autres réglages', section: 'Mise en ligne', logo: '/logos/services/cle.svg', description: 'Réglages divers.', keys: [] }
