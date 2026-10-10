// UNE seule source de vérité pour le nom, les menus, les textes génériques et les modules du site.
// Produits, prix, formations et leçons : EN BASE, réglés dans /admin/products (jamais dans le code).
// Clés des services (paiement, e-mails, IA) : /admin/keys (jamais dans le code).

type DashboardIcon = 'home' | 'bag' | 'inbox' | 'alert' | 'help' | 'user' | 'list' | 'play' | 'shop' | 'users' | 'calendar' | 'bolt'

/** Briques du SaaS : chacune s'allume ou s'éteint ici (menus, pages et accueil suivent). */
export type ModuleId = 'formations' | 'boutique' | 'communaute' | 'appels' | 'avis' | 'demandes' | 'credits'

export const site = {
  // Nom de la plateforme (logo, titres, e-mails, factures).
  name: '{{APP_NAME}}',
  // Personne derrière la plateforme (formateur, fondateur) : signe les e-mails et l'« À propos ». Vide = le nom du site.
  person: '',
  // Logo carré (fichier dans public/). Rond dans la barre de navigation.
  logo: '/logo.svg',
  tagline: 'Formations, produits et services en ligne',
  description: 'Apprends, achète et avance : formations en ligne, accompagnements, produits numériques et services, avec paiement Mobile Money, carte, PayPal ou crypto.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://yoursaas.app',
  supportEmail: 'support@yoursaas.app',
  // Numéro WhatsApp du support, avec l'indicatif (ex. '+225 07 00 00 00 00'). Sert aussi aux captures des paiements manuels.
  whatsapp: '',
  locale: 'fr_FR',
  // Vendeur affiché sur les factures : à compléter (adresse, numéro fiscal) avant de facturer des entreprises.
  company: { legalName: '{{APP_NAME}}', address: '', taxId: '' },
  // Devises : les prix sont en FCFA ; le cron update-rates tient les taux à jour (USD pour Binance).
  currencies: ['XOF', 'EUR', 'USD'],
  // Fuseau des créneaux d'appel, des promotions et des statistiques (sans heure d'été).
  timezone: { offsetHours: 1, iana: 'Africa/Douala', label: 'heure de Douala (UTC+1)' },
  // Page de paiement : pays proposé par défaut et exemple de numéro.
  payments: { defaultCountry: 'Côte d’Ivoire', phoneExample: '+225…' },

  // Modules actifs. Un module coupé disparaît des menus, de l'accueil et répond « page introuvable ».
  modules: {
    formations: true, // cours en parcours (leçons en étapes, questionnaire d'accueil, progression, abonnement « Rester à jour »)
    boutique: true,   // produits numériques, logiciels, services, fichiers à télécharger
    communaute: true, // groupes façon WhatsApp (annonces, discussion), incluse avec les formations
    appels: true,     // heure d'appel payée puis réservée dans un calendrier
    avis: true,       // avis vérifiés des élèves et projets d'élèves
    demandes: true,   // devis, coaching, services sur demande
    credits: false,   // SaaS à l'usage : packs de crédits, solde, consommation (voix, images, générateurs…)
  } satisfies Record<ModuleId, boolean>,

  // Réseaux affichés dans le pied de page (vide = masqué).
  socials: { youtube: '', facebook: '', instagram: '', tiktok: '', linkedin: '', x: '' },

  // Premier écran de l'accueil.
  hero: {
    badge: { label: 'Nouveau', text: 'Découvre nos formations', href: '/formations' },
    title: 'Apprends, crée et vends',
    highlight: 'en ligne.',
    text: 'Des formations sur des projets réels, des accompagnements en direct et des outils prêts à l’emploi. Paiement Mobile Money, carte, PayPal ou crypto.',
    motto: '',
    chips: ['Formations', 'Accompagnements', 'Produits numériques', 'Services'],
  },

  // Panneau gauche de la connexion et de l'inscription.
  auth: {
    signupKicker: 'Bienvenue',
    signupTitle: 'Crée ton compte en une minute.',
    loginKicker: 'Bon retour',
    loginTitle: 'On reprend où tu t’es arrêté.',
    mission: 'Tes formations, tes achats et tes factures au même endroit, sur ordinateur comme sur téléphone.',
    footer: 'Paiement sécurisé',
  },

  // « À propos » de l'accueil (null = section masquée). photo : fichier dans public/.
  about: null as null | { title: string; photo: string; paragraphs: string[]; roles: string[]; link?: { label: string; href: string } },

  // Menu du site public. module : la ligne disparaît si le module est coupé.
  nav: [
    { href: '/formations', label: 'Formations', module: 'formations' },
    { href: '/boutique', label: 'Boutique', module: 'boutique' },
    { href: '/boutique#service', label: 'Services', module: 'boutique' },
    { href: '/dashboard', label: 'Mon espace' },
  ] as { href: string; label: string; module?: ModuleId }[],

  // Menu de gauche de l'espace client : chaque nouvelle page connectée y ajoute sa ligne.
  dashboardNav: [
    { href: '/dashboard', label: 'Accueil', icon: 'home' },
    { href: '/mes-achats', label: 'Mes achats', icon: 'play' },
    { href: '/credits', label: 'Crédits', icon: 'bolt', module: 'credits' },
    { href: '/communaute', label: 'Communauté', icon: 'users', module: 'communaute' },
    { href: '/appels', label: 'Appels', icon: 'calendar', module: 'appels' },
    { href: '/dashboard/boutique', label: 'Boutique', icon: 'shop', module: 'boutique' },
    { href: '/demandes', label: 'Demandes', icon: 'inbox', module: 'demandes' },
    { href: '/billing-history', label: 'Factures', icon: 'list' },
    { href: '/support', label: 'Aide', icon: 'help' },
  ] as { href: string; label: string; icon: DashboardIcon; module?: ModuleId }[],

  features: [] as { title: string; text: string }[],
  // Questions fréquentes de l'accueil (vide = section masquée).
  faq: [
    { q: 'Comment je reçois mon accès ?', a: 'Dès que le paiement est confirmé, ton accès s’ajoute à ton compte et tu reçois un e-mail avec un lien de connexion directe et ta facture.' },
    { q: 'Quels moyens de paiement ?', a: 'Mobile Money (Orange, MTN, Moov…), Wave, carte bancaire, PayPal et crypto (USDT), selon ce qui est proposé sur la page de paiement.' },
    { q: 'Je n’ai pas de compte, je peux acheter ?', a: 'Oui : ton compte est créé automatiquement avec ton e-mail au moment du paiement.' },
  ] as { q: string; a: string }[],
}

/** Ce module est-il allumé ? */
export const hasModule = (id: ModuleId) => site.modules[id]

/** Nom qui signe les e-mails et le contenu : la personne, sinon la plateforme. */
export const signature = () => site.person || site.name

/** Lien de contact du support : WhatsApp s'il y a un numéro, sinon l'e-mail. */
export const contactLink = (text?: string) => whatsappLink(text) ?? `mailto:${site.supportEmail}`
/** « WhatsApp » ou « e-mail », selon le canal de contact disponible. */
export const contactChannel = () => (site.whatsapp ? 'WhatsApp' : 'e-mail')

/** Lien WhatsApp du support (null si aucun numéro), avec un message pré-rempli facultatif. */
export function whatsappLink(text?: string): string | null {
  const digits = site.whatsapp.replace(/[^\d]/g, '')
  if (!digits) return null
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
