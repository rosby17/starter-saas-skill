// CATALOGUE DES CLÉS réglables depuis /admin/keys (« Clés et intégrations »).
//
// Une clé saisie dans l'admin est chiffrée en base (table app_secrets) puis chargée dans
// process.env au démarrage et à chaque enregistrement : le reste du code continue de lire
// process.env.X sans rien savoir. Une valeur saisie dans l'admin PRIME sur celle du serveur.
//
// Ne figurent PAS ici (à poser dans l'environnement du serveur, une seule fois) :
// - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY : il les faut pour lire la base ;
// - toute variable NEXT_PUBLIC_* : elle est figée dans le code au moment du build.
//
// Ajouter une passerelle : ajoute ses clés ici avec `gateway: '<id>'`.

export type SecretRequirement =
  | { kind: 'always' }            // indispensable au SaaS
  | { kind: 'gateway'; id: string } // indispensable seulement si cette passerelle est active
  | { kind: 'optional' }

export type SecretDefinition = {
  name: string
  label: string
  group: string
  help: string
  /** true : valeur masquée à l'affichage (seuls les 4 derniers caractères). */
  secret: boolean
  requirement: SecretRequirement
  /** true : l'admin peut générer une valeur aléatoire (secret que l'on choisit soi-même). */
  generate?: boolean
  /** Affiche l'adresse de retour à déclarer chez Google (adresse de la base + /auth/v1/callback). */
  oauthCallback?: boolean
  /** Chemin du webhook à coller chez la passerelle (affiché avec l'adresse du site). */
  webhookPath?: string
  /** Valeur utilisée par le code quand rien n'est posé : affichée (et modifiable) dans le champ de l'admin. */
  defaultValue?: string
}

const gw = (id: string): SecretRequirement => ({ kind: 'gateway', id })

export const SECRET_CATALOG: SecretDefinition[] = [
  // --- Tâches planifiées
  { name: 'CRON_SECRET', label: 'Secret des tâches planifiées', group: 'Tâches planifiées', secret: true, requirement: { kind: 'always' }, generate: true,
    help: "Ton planificateur envoie « Authorization: Bearer <ce secret> » aux routes /api/cron/*. Sans lui, toutes les tâches planifiées sont refusées." },

  // --- E-mails
  { name: 'BREVO_API_KEY', label: 'Clé API Brevo', group: 'E-mails (Brevo)', secret: true, requirement: { kind: 'always' },
    help: 'Brevo > SMTP & API > Clés API. Sans elle, aucun e-mail (reçus, notifications) ne part.' },
  { name: 'BREVO_SENDER_EMAIL', label: "Adresse d'expédition", group: 'E-mails (Brevo)', secret: false, requirement: { kind: 'always' },
    help: 'Doit être un expéditeur vérifié dans Brevo.' },
  { name: 'BREVO_SENDER_NAME', label: "Nom d'expéditeur", group: 'E-mails (Brevo)', secret: false, requirement: { kind: 'optional' },
    help: 'Nom affiché dans la boîte de réception.' },
  { name: 'ADMIN_NOTIFY_EMAIL', label: 'E-mail qui reçoit les alertes', group: 'E-mails (Brevo)', secret: false, requirement: { kind: 'optional' },
    help: 'Ton adresse : tu y reçois une alerte à chaque vente et à chaque nouvelle demande.' },
  { name: 'BREVO_SMTP_LOGIN', label: 'Identifiant SMTP', group: 'E-mails (Brevo)', secret: false, requirement: { kind: 'optional' },
    help: 'Brevo → SMTP & API → onglet SMTP : « Identifiant ». Sert aux e-mails de connexion du site en ligne (confirmation, mot de passe oublié).' },
  { name: 'BREVO_SMTP_KEY', label: 'Clé SMTP', group: 'E-mails (Brevo)', secret: true, requirement: { kind: 'optional' },
    help: 'Brevo → SMTP & API → onglet SMTP → Générer une clé SMTP. Sans elle, les comptes en ligne sont confirmés sans e-mail.' },

  // --- Connexion Google (facultative) : appliquée à la base à la prochaine mise en ligne ou « Redéployer »
  { name: 'GOOGLE_CLIENT_ID', label: 'ID client Google', group: 'Connexion avec Google', secret: false, requirement: { kind: 'optional' }, oauthCallback: true,
    help: 'console.cloud.google.com → API et services → Identifiants → Créer → ID client OAuth → Application Web. Colle l’adresse de redirection ci-dessous dans « URI de redirection autorisés ».' },
  { name: 'GOOGLE_CLIENT_SECRET', label: 'Code secret du client Google', group: 'Connexion avec Google', secret: true, requirement: { kind: 'optional' },
    help: 'Affiché par Google avec l’ID client. Ensuite : Mise en ligne → Redéployer, et le bouton « Continuer avec Google » apparaît sur la connexion et l’inscription.' },

  // --- Mise en ligne (utilisées par /admin/deploy ; facultatives tant qu'on ne déploie pas)
  { name: 'GITHUB_TOKEN', label: 'Jeton GitHub', group: 'Mise en ligne', secret: true, requirement: { kind: 'optional' },
    help: 'github.com/settings/tokens → Generate new token (classic), case « repo ». Le code part dans un dépôt PRIVÉ.' },
  { name: 'COOLIFY_URL', label: 'Adresse de Coolify', group: 'Mise en ligne', secret: false, requirement: { kind: 'optional' },
    help: 'L’adresse de ton tableau de bord Coolify, ex. https://coolify.mondomaine.com' },
  { name: 'COOLIFY_API_TOKEN', label: 'Jeton API Coolify', group: 'Mise en ligne', secret: true, requirement: { kind: 'optional' },
    help: 'Coolify → Keys & Tokens → API tokens → Create, droit « root » (ou read, read:sensitive, write, deploy). Active l’API dans Settings → Advanced si besoin. Sert aussi à installer la base de données sur ton serveur.' },
  { name: 'HOSTINGER_API_TOKEN', label: 'Jeton API Hostinger', group: 'Mise en ligne', secret: true, requirement: { kind: 'optional' },
    help: 'hPanel → Profil → API → Nouveau jeton. Pour régler le domaine (DNS) et, si tu veux, l’acheter.' },
  { name: 'CLOUDFLARE_API_TOKEN', label: 'Jeton API Cloudflare', group: 'Mise en ligne', secret: true, requirement: { kind: 'optional' },
    help: 'Cloudflare → Mon profil → Jetons API → Créer → modèle « Modifier la zone DNS ». Si ton domaine est chez Cloudflare.' },

  // --- Paiement
  { name: 'TARA_API_KEY', label: 'Clé API', group: 'Tara Money', secret: true, requirement: gw('taramoney'), help: 'Tableau de bord Tara Money.' },
  { name: 'TARA_BUSINESS_ID', label: 'Identifiant business', group: 'Tara Money', secret: false, requirement: gw('taramoney'), help: 'Tableau de bord Tara Money.' },
  { name: 'TARA_WEBHOOK_SECRET', label: 'Secret du webhook', group: 'Tara Money', secret: true, requirement: gw('taramoney'), generate: true,
    help: 'Secret que tu choisis (bouton Générer) ; il est ajouté à l’adresse de retour envoyée à Tara.' },

  { name: 'WARAPPAY_API_KEY', label: 'Clé API', group: 'Warappay', secret: true, requirement: gw('warappay'), help: 'Tableau de bord Warappay.' },
  { name: 'WARAPPAY_PRODUCT_CODE', label: 'Code produit (prix libre)', group: 'Warappay', secret: false, requirement: gw('warappay'), help: 'Un produit à prix variable pour tous les forfaits.' },
  { name: 'WARAPPAY_WEBHOOK_SECRET', label: 'Secret du webhook', group: 'Warappay', secret: true, requirement: gw('warappay'), webhookPath: '/api/payment/webhook/warappay',
    help: 'Donné par Warappay quand tu déclares l’adresse du webhook.' },
  { name: 'MAKETOU_API_KEY', label: 'Clé API Maketou', group: 'Maketou', secret: true, requirement: gw('maketou'),
    help: 'maketou.net → ta boutique → Paramètres → API : la clé secrète (Bearer).' },
  { name: 'MAKETOU_PRODUCT_ID', label: 'Identifiant du produit Maketou', group: 'Maketou', secret: false, requirement: gw('maketou'),
    help: 'Le « productDocumentId » du produit Maketou à prix libre qui reçoit les paiements (le montant exact est envoyé à chaque paiement).' },
  { name: 'WARAPPAY_CURRENCY', label: 'Devise de la boutique', group: 'Warappay', secret: false, requirement: { kind: 'optional' }, defaultValue: 'XOF', help: 'XOF ou XAF.' },

  { name: 'WAVE_NUMBER', label: 'Numéro Wave du partenaire', group: 'Wave (manuel)', secret: false, requirement: { kind: 'optional' }, help: 'Numéro Wave qui reçoit les paiements (avec l’indicatif). Sans lui, Wave n’apparaît pas sur la page de paiement.' },
  { name: 'WAVE_NAME', label: 'Nom affiché dans Wave', group: 'Wave (manuel)', secret: false, requirement: { kind: 'optional' }, help: 'Le nom que le client voit dans Wave avant d’envoyer.' },

  // --- Mobile Money direct (manuel) : dépôt ou code marchand sur tes numéros, validé à la main dans /admin/orders
  { name: 'MOMO_DIRECT_1_OPERATOR', label: 'Opérateur du numéro 1', group: 'Mobile Money direct (manuel)', secret: false, requirement: { kind: 'optional' }, help: 'Nom affiché au client (ex. Orange Money). Vide : « Mobile Money ».' },
  { name: 'MOMO_DIRECT_1_NUMBER', label: 'Numéro 1', group: 'Mobile Money direct (manuel)', secret: false, requirement: { kind: 'optional' }, help: 'Numéro Mobile Money qui reçoit les paiements, avec l’indicatif. Sans aucun numéro, Mobile Money direct n’apparaît pas sur la page de paiement.' },
  { name: 'MOMO_DIRECT_1_USSD', label: 'Code marchand du numéro 1', group: 'Mobile Money direct (manuel)', secret: false, requirement: { kind: 'optional' }, help: 'Facultatif. Code à composer, {montant} est remplacé par le montant exact (ex. *126*14*6XXXXXXXX*{montant}#).' },
  { name: 'MOMO_DIRECT_2_OPERATOR', label: 'Opérateur du numéro 2', group: 'Mobile Money direct (manuel)', secret: false, requirement: { kind: 'optional' }, help: 'Nom affiché au client (ex. MTN MoMo). Vide : « Mobile Money ».' },
  { name: 'MOMO_DIRECT_2_NUMBER', label: 'Numéro 2', group: 'Mobile Money direct (manuel)', secret: false, requirement: { kind: 'optional' }, help: 'Facultatif : un second numéro (autre opérateur).' },
  { name: 'MOMO_DIRECT_2_USSD', label: 'Code marchand du numéro 2', group: 'Mobile Money direct (manuel)', secret: false, requirement: { kind: 'optional' }, help: 'Facultatif. Code à composer, {montant} est remplacé par le montant exact (ex. *126*14*6XXXXXXXX*{montant}#).' },
  { name: 'MOMO_DIRECT_HOLDER', label: 'Titulaire des numéros', group: 'Mobile Money direct (manuel)', secret: false, requirement: { kind: 'optional' }, help: 'Nom que le client voit avant d’envoyer.' },
  { name: 'MOMO_DIRECT_COUNTRY', label: 'Pays des numéros (code)', group: 'Mobile Money direct (manuel)', secret: false, requirement: { kind: 'optional' }, help: 'Code du pays à deux lettres (ex. CM) : le moyen s’affiche en premier dans ce pays, en dernier ailleurs.' },

  { name: 'BINANCE_PAY_ID', label: 'Binance Pay ID', group: 'Binance Pay (manuel)', secret: false, requirement: gw('binance'),
    help: 'Ton identifiant Binance Pay, affiché au client sur la page de paiement.' },
  { name: 'BINANCE_PAY_NAME', label: 'Nom affiché dans Binance', group: 'Binance Pay (manuel)', secret: false, requirement: { kind: 'optional' }, help: 'Le nom que le client voit avant d’envoyer.' },
  { name: 'USDT_TRC20_ADDRESS', label: 'Adresse USDT (TRC20)', group: 'Binance Pay (manuel)', secret: false, requirement: { kind: 'optional' }, help: 'Pour ceux qui paient en USDT sans compte Binance (réseau TRON uniquement).' },
  // --- Intelligence artificielle (parcours personnalisé des formations)
  { name: 'KIE_API_KEY', label: 'Clé kie.ai (Claude)', group: 'Intelligence artificielle', secret: true, requirement: { kind: 'optional' },
    help: "Clé de ton compte kie.ai (kie.ai → API Key). Elle sert à analyser le questionnaire d'accueil d'une formation et à proposer à chaque élève son parcours personnalisé. Sans elle, le parcours est calculé par des règles simples." },
  { name: 'KIE_API_KEY_2', label: 'Clé kie.ai de relais (second compte)', group: 'Intelligence artificielle', secret: true, requirement: { kind: 'optional' },
    help: "Facultatif : clé d'un second compte kie.ai. Si le premier refuse (solde épuisé, clé révoquée, saturation), la demande passe sur celui-ci sans que le client ne voie rien (Administration › Moteurs IA)." },
  // --- Coach business (Administration › Coach) : Claude par l'API Anthropic, kie.ai en secours
  { name: 'ANTHROPIC_API_KEY', label: 'Clé API Anthropic (Claude)', group: 'Intelligence artificielle', secret: true, requirement: { kind: 'optional' },
    help: "platform.claude.com → API Keys → Create Key. Sert au coach business (point du jour, questions, analyse des réponses clients). Sans elle, le coach passe par kie.ai s'il est réglé, sinon il reste éteint." },
  { name: 'COACH_MODEL', label: 'Modèle Claude du coach', group: 'Intelligence artificielle', secret: false, requirement: { kind: 'optional' }, defaultValue: 'claude-sonnet-5-5',
    help: 'Identifiant exact du modèle (ex. claude-sonnet-5-5, claude-opus-5-5). Changeable sans redéployer.' },
  { name: 'COACH_FALLBACK_MODEL', label: 'Modèle Claude de secours', group: 'Intelligence artificielle', secret: false, requirement: { kind: 'optional' }, defaultValue: 'claude-opus-5-5',
    help: 'Repris si le premier modèle décline la demande ou échoue. Vide = directement kie.ai.' },
]

const BY_NAME = new Map(SECRET_CATALOG.map((d) => [d.name, d]))

export const getSecretDefinition = (name: string): SecretDefinition | null => BY_NAME.get(name) ?? null

// Valeurs d'exemple recopiées de .env.example : elles ne comptent PAS comme une clé posée.
export const isPlaceholder = (value: string | undefined): boolean =>
  !value || /^(your-|generate-a-long|changeme|xxx)/i.test(value.trim())
