// UNE seule source de vérité pour tout ce qui change d'un SaaS à l'autre :
// l'agent /starter-saas modifie ce fichier (et pricing.ts), rien d'autre pour le branding.
export const site = {
  name: '{{APP_NAME}}',
  tagline: 'La promesse en une phrase.',
  description: 'Description courte pour Google et les réseaux sociaux.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  supportEmail: 'support@yoursaas.app',
  locale: 'fr_FR',
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
