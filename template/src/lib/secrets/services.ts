// Présentation de /admin/keys : chaque service (le `group` des clés dans catalog.ts) est rangé dans un THÈME,
// avec son logo officiel (public/logos/services/, pastille blanche), une phrase d'usage et le lien « Où la trouver ».
// Un service sans logo officiel a un pictogramme clair, jamais une initiale dans un carré coloré.
// Nouveau service : ajoute ses clés dans catalog.ts, puis une ligne ici (sinon il tombe dans « Serveur et mise en ligne »).

export const THEMES = [
  { id: 'paiements', title: 'Paiements et revenus', desc: 'Les passerelles qui encaissent les ventes. Une seule suffit pour commencer.' },
  { id: 'emails', title: 'E-mails et connexion', desc: 'Envoi des e-mails du site et connexion avec Google.' },
  { id: 'contenu', title: 'Contenu et automatisation', desc: 'Intelligence artificielle et tâches planifiées.' },
  { id: 'serveur', title: 'Serveur et mise en ligne', desc: 'Dépôt du code, serveur et nom de domaine.' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export type ServiceInfo = {
  theme: ThemeId
  /** Chemin du logo dans public/. */
  logo: string
  description: string
  where?: { label: string; url: string }
}

export const SERVICES: Record<string, ServiceInfo> = {
  'Tara Money': { theme: 'paiements', logo: '/logos/services/taramoney.png', description: 'Mobile Money, carte bancaire et PayPal.' },
  'Warappay': { theme: 'paiements', logo: '/logos/services/warappay.png', description: 'Mobile Money, carte bancaire et PayPal, en XOF ou XAF.',
    where: { label: 'Tableau de bord Warappay', url: 'https://warappay.com' } },
  'Maketou': { theme: 'paiements', logo: '/logos/services/maketou.png',
    description: 'Mobile Money en FCFA. Sans webhook : chaque paiement est vérifié au retour du client et toutes les 15 minutes.',
    where: { label: 'Tableau de bord Maketou', url: 'https://maketou.net' } },
  'Wave (manuel)': { theme: 'paiements', logo: '/logos/services/wave.png',
    description: 'Le client envoie le montant à ton numéro Wave puis la capture ; tu valides la commande à la main.' },
  'Mobile Money direct (manuel)': { theme: 'paiements', logo: '/logos/services/mobile-money.svg',
    description: 'Le client envoie le montant sur tes numéros (dépôt ou code marchand) puis la capture ; tu valides la commande à la main.' },
  'Binance Pay (manuel)': { theme: 'paiements', logo: '/logos/services/binance.png',
    description: 'Paiement en crypto sur ton identifiant ; tu valides la commande à la main.',
    where: { label: 'Application Binance › Pay › mon identifiant Pay', url: 'https://www.binance.com/fr/pay' } },

  'E-mails (Brevo)': { theme: 'emails', logo: '/logos/services/brevo.png',
    description: 'Envoie les e-mails du site : bienvenue, accès, liens de connexion, alertes de vente.',
    where: { label: 'Brevo › SMTP & API', url: 'https://app.brevo.com/settings/keys/api' } },
  'Connexion avec Google': { theme: 'emails', logo: '/logos/services/google.svg',
    description: 'Ajoute « Continuer avec Google » sur la connexion et l’inscription.',
    where: { label: 'Google Cloud › Identifiants', url: 'https://console.cloud.google.com/apis/credentials' } },

  'kie.ai': { theme: 'contenu', logo: '/logos/services/kie.png',
    description: 'Analyse le questionnaire d’accueil et prépare le parcours personnalisé de chaque élève.',
    where: { label: 'kie.ai › API Key', url: 'https://kie.ai/api-key' } },
  'Anthropic (Claude)': { theme: 'contenu', logo: '/logos/services/anthropic.svg',
    description: 'Le coach business : point du jour, questions libres, analyse des réponses des clients.',
    where: { label: 'Claude Console › API Keys', url: 'https://platform.claude.com/settings/keys' } },
  'Tâches planifiées': { theme: 'contenu', logo: '/logos/services/taches-planifiees.svg',
    description: 'Protège les tâches automatiques : rattrapage des paiements, rappels d’abonnement.' },

  'GitHub': { theme: 'serveur', logo: '/logos/services/github.svg', description: 'Dépôt privé du code du site.',
    where: { label: 'GitHub › Settings › Tokens', url: 'https://github.com/settings/tokens' } },
  'Coolify': { theme: 'serveur', logo: '/logos/services/coolify.svg', description: 'Le serveur qui héberge le site et la base de données.' },
  'Cloudflare': { theme: 'serveur', logo: '/logos/services/cloudflare.svg', description: 'Nom de domaine et DNS.',
    where: { label: 'Cloudflare › Jetons API', url: 'https://dash.cloudflare.com/profile/api-tokens' } },
  'Hostinger': { theme: 'serveur', logo: '/logos/services/hostinger.svg', description: 'Nom de domaine et DNS, si le domaine est chez Hostinger.' },
}

export const FALLBACK_LOGO = '/logos/services/cle.svg'

export const themeOf = (group: string): ThemeId => SERVICES[group]?.theme ?? 'serveur'
