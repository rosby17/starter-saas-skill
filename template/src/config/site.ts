// UNE seule source de vérité pour tout ce qui change d'un SaaS à l'autre :
// l'agent /starter-saas modifie ce fichier (et pricing.ts), rien d'autre pour le branding.
export const site = {
  name: '{{APP_NAME}}',
  // Logo : fichier dans public/ (ex. '/logo.svg', fond transparent, ~ 160×40). Vide = carré aux couleurs de la marque + nom (components/Logo.tsx).
  // Icône d'onglet : déposer src/app/icon.png (512×512). Couleurs et police : src/app/globals.css (bloc CHARTE GRAPHIQUE).
  logo: '',
  tagline: 'La promesse en une phrase.',
  description: 'Description courte pour Google et les réseaux sociaux.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  supportEmail: 'support@yoursaas.app',
  locale: 'fr_FR',
  // Vendeur affiché sur les factures : à remplir avant de facturer (raison sociale, adresse, numéro fiscal).
  company: { legalName: '{{APP_NAME}}', address: 'Adresse de l\'entreprise', taxId: '' },
  // Devises proposées aux clients (le cron update-rates tient leurs taux à jour).
  currencies: ['XOF', 'EUR', 'USD'],
  // Barre du haut des pages publiques
  nav: [
    { href: '/#fonctionnalites', label: 'Fonctionnalités' },
    { href: '/pricing', label: 'Tarifs' },
    { href: '/#faq', label: 'Questions' },
  ],
  // Menu de gauche de l'espace client : le skill ajoute une ligne par entité générée
  dashboardNav: [
    { href: '/dashboard', label: 'Tableau de bord', icon: 'home' },
    { href: '/billing', label: 'Abonnement', icon: 'card' },
    { href: '/billing-history', label: 'Mes paiements', icon: 'list' },
    { href: '/support', label: 'Aide', icon: 'help' },
    { href: '/settings', label: 'Mon compte', icon: 'user' },
  ] as { href: string; label: string; icon: 'home' | 'card' | 'help' | 'user' | 'list' }[],
  features: [
    { title: 'Fonctionnalité 1', text: 'Ce que ça apporte, en une phrase concrète.' },
    { title: 'Fonctionnalité 2', text: 'Ce que ça apporte, en une phrase concrète.' },
    { title: 'Fonctionnalité 3', text: 'Ce que ça apporte, en une phrase concrète.' },
  ],
  faq: [
    { q: 'Comment ça marche ?', a: 'Réponse courte et claire.' },
    { q: 'Puis-je annuler à tout moment ?', a: 'Oui, depuis la page Abonnement.' },
  ],
}
