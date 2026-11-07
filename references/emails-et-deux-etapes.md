# E-mails qui arrivent vraiment, et validation en deux étapes au choix

Appris de KappGen (06/10/2026), le jour du lancement : le site affichait « Code envoyé » alors qu'AUCUN e-mail ne partait depuis le début
(clé Brevo invalide, 401 « Key not found »). Personne ne le voyait : l'envoi se faisait en arrière-plan et l'échec n'était noté que sur le serveur.

## E-mails
1. **Un e-mail dont la personne a besoin tout de suite (code de connexion, lien de mot de passe) s'envoie en ATTENDANT la réponse du
   fournisseur** ; en cas d'échec, l'écran dit la vraie raison (« Le code n'a pas pu être envoyé par e-mail : … Utilisez l'application
   d'authentification »), jamais un faux « envoyé ». Les autres (reçus, rapports) peuvent partir en arrière-plan.
2. **Journal des e-mails dans l'admin** : sujet, destinataire, heure, « Envoyé » / « Échec » + la réponse exacte du fournisseur.
3. **Bouton « M'envoyer un exemple de chaque e-mail »** dans l'admin : chaque modèle part à l'adresse de l'administrateur seulement,
   sujet préfixé « [Exemple] », données fictives et liens inoffensifs, avec le résultat de chaque envoi. À cliquer AVANT le lancement et
   après tout changement de clé.
4. **Jamais un secret dans le SUJET** (code, lien) : les sujets sont journalisés et visibles dans l'admin. Le code va dans le corps.
5. **N'envoyer que l'utile** (décision de Roosevelt) : pas d'e-mail de bienvenue ni d'alerte « nouvelle connexion » ; chaque envoi coûte.
6. **Tests** : ne jamais laisser un test appeler le vrai fournisseur. Remplacer l'envoi sur l'INSTANCE de test (`site.envoyer_courriel = …`,
   `site.courriel_actif = lambda: True`), jamais en modifiant une fonction du module pour tous les tests (un test l'avait fait : un vrai
   appel est parti vers Brevo).

7. **Ton des messages aux clients** (relances, rappels, messages préparés par un coach ou une IA) : toujours au nom de l'équipe, à la
   première personne du pluriel (« nous », « notre équipe »), jamais « je » ; vouvoiement, ton professionnel, fin sobre
   (« Cordialement, l'équipe <Produit> »). À écrire noir sur blanc dans le prompt de l'IA qui rédige, sinon elle écrit « Je reste disponible ».

## Recevoir les réponses des clients (sans payer de boîte mail)
Appris d'iziVoice (23/10/2026) : les e-mails partaient bien (Brevo), avec « Répondre à » = support@<domaine>, mais le domaine pointait
encore vers une boîte Hostinger jamais payée. Chaque réponse de client était PERDUE, sans que personne le sache. Envoyer ne suffit pas :
il faut vérifier que l'adresse de réponse reçoit vraiment.

1. **Vérifier d'abord** : `dig +short MX <domaine>` (où arrive le courrier) et `dig +short TXT <domaine>` (la ligne `v=spf1`). Si les MX
   pointent vers un hébergeur sans boîte active, les réponses sont perdues : le dire tout de suite au propriétaire.
2. **Solution gratuite recommandée : Cloudflare Email Routing → Gmail** (si le DNS est chez Cloudflare ; sinon, y transférer le domaine
   ou prendre Zoho Mail gratuit / Google Workspace payant pour une vraie boîte).
   - Cloudflare → domaine → **Email → Email Routing** → activer. S'il refuse (« Existing non-Cloudflare MX records conflict »), supprimer
     les anciennes lignes MX (ex. `mx1/mx2.hostinger.com`) dans DNS → Records.
   - **Une seule ligne `v=spf1`** : modifier celle qui existe au lieu d'accepter celle de l'assistant, qui oublie le service d'envoi.
     Exemple : `v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all`. Deux lignes `v=spf1` = les deux ignorées = spam.
   - **Destination addresses** : y mettre seulement le Gmail du propriétaire (lien de confirmation à cliquer). JAMAIS support@ lui-même
     (jamais vérifiable, boucle).
   - **Routing rules** → Create routing rule : `support` → Send to an email → Gmail ; idem `contact`. Laisser le Catch-all désactivé (spam).
   - Revérifier par `dig` : MX = `route1/2/3.mx.cloudflare.net`, un seul `v=spf1`.
3. **Le premier e-mail renvoyé tombe souvent dans les spams de Gmail** : filtre Gmail, champ **À** (pas « Contient les mots », qui
   attraperait toutes les notifications du site) = `support@<domaine> OR contact@<domaine>` → « Ne jamais envoyer dans le spam » +
   libellé « Clients <Produit> ». Tester depuis une AUTRE adresse que le Gmail de destination.
4. **Répondre au nom de support@ depuis Gmail** : Gmail → Paramètres → Comptes et importation → « Envoyer des e-mails en tant que » →
   nom « L'équipe <Produit> », adresse support@<domaine>, décocher « Traiter comme un alias » ; SMTP `smtp-relay.brevo.com`, port 587,
   TLS, identifiant et clé SMTP pris dans Brevo → SMTP & API (le propriétaire les saisit lui-même, jamais dans le chat). L'identifiant
   est celui affiché par Brevo : `xxxx@smtp-brevo.com` sur les comptes récents, l'adresse du compte sur les anciens ; le mot de passe est
   une CLÉ SMTP générée (montrée une seule fois), jamais le mot de passe Brevo. Confirmer par le lien reçu sur support@ (il arrive grâce
   au renvoi), puis cocher « Répondre à partir de l'adresse à laquelle le message a été envoyé ».
   - **Nom d'expéditeur** : soigné et dans la langue des clients (« L'équipe <Produit> »). Vu chez iziVoice : « Roosevelt » proposé par
     défaut, puis « IziVoice Teams » (faute d'anglais), à corriger dans « modifier les informations ».
   - **Test final** : répondre au test ; chez le destinataire, l'expéditeur doit être support@<domaine>, sans « envoyé par <gmail> », et
     le message hors spam.
5. Si le SaaS analyse les réponses des clients (coach, CRM), dire où les coller tant qu'elles ne remontent pas toutes seules (piste
   d'automatisation : Email Worker Cloudflare ou réception automatique de Brevo vers une route du site).

## Validation en deux étapes
- **Au choix** dans Sécurité : « Par e-mail » (le plus simple) ou « Avec une application » (Google Authenticator, Microsoft Authenticator,
  Authy : marche sans Internet). Le même écran de connexion, avec un texte adapté à la méthode.
- **Code par e-mail** : 6 chiffres, valable 10 minutes, usage unique, stocké haché, remplacé par chaque nouvel envoi, 6 envois par heure au
  plus ; essais comptés en base (8 en 10 min, 20 en 24 h). « Renvoyer un code » à l'activation ; pour les actions sensibles (désactiver,
  nouveaux codes de secours, changer d'adresse) un bouton « Recevoir un code par e-mail ».
- **Connexions sans page** (extension, API) : sans code, on envoie le code par e-mail et on répond « un code vient d'être envoyé ».
- **Codes de secours** dans les deux cas (8 codes, usage unique, montrés une seule fois). Conseiller de les garder hors de l'ordinateur ;
  si on les range sur le poste, dans un fichier privé (droits 600) HORS du dépôt git, jamais commité.
- **Prudence à l'activation par e-mail** : vérifier d'abord que les e-mails partent (bouton d'exemples), sinon proposer l'application.
- L'administration exige la deuxième étape (adresse d'admin ET adresse confirmée ET deuxième étape active).

## Leçons Ballon Viral (06/11/2026) : adresse de contact au nom du domaine

- **Une seule adresse publique** `contact@<domaine>` (site.supportEmail) : expéditeur ET « Répondre à » par défaut de `sendEmail`
  (le modèle le fait), affichée sur Contact, Confidentialité, CGU, mentions légales et dans le pied de chaque e-mail.
- **Routage Cloudflare en 3 clics** : Email Routing > Routing rules > `contact` vers le Gmail vérifié, puis Settings > DNS records >
  « Add missing records » (pose les 3 MX `routeN.mx.cloudflare.net`, le SPF et la clé DKIM de Cloudflare). Contrôler par `dig`.
  Si Brevo envoie au nom du domaine, ajouter `include:spf.brevo.com` dans la MÊME ligne `v=spf1` que Cloudflare a créée.
- **Brevo** : le code `brevo-code:` peut déjà être dans la zone (domaine ajouté plus tôt dans Brevo) : il reste DKIM `brevo1/brevo2`
  et `_dmarc` (Brevo propose la connexion automatique à Cloudflare), puis l'expéditeur `contact@<domaine>` (son code de validation
  arrive dans le Gmail grâce au routage). Le propriétaire colle lui-même la clé API et la clé SMTP dans /admin/keys.
- **Un seul habillage pour tous les e-mails** : logo, bouton aux couleurs de la marque (texte blanc), pied de page avec l'adresse
  de contact, quelques liens du site et UNE phrase « Tu reçois cet e-mail parce que… » propre à chaque modèle. Les gabarits de
  connexion de GoTrue (`public/email-templates`) suivent le même habillage et la même langue que le site : un projet parti d'un
  ancien site gardait des gabarits en anglais au nom d'un autre produit. À relire à chaque nouveau SaaS.
- **L'habillage du modèle** (`template/src/lib/email/layout.ts`, repris de Ballon Viral le 07/11/2026) : `emailLayout({ body, reason,
  preheader?, eyebrow?, title? })` donne un en-tête sombre avec le logo PNG sur une pastille de la couleur de marque et un trait de couleur,
  un sur-titre et un grand titre facultatifs, la carte de contenu, puis un pied de page en trois parties : carte d'aide (« réponds à cet
  e-mail » + contact), liens du site (menu public filtré par modules + Mon espace), mentions et raison de l'envoi. Aides : `emailButton(href,
  label, 'primary' | 'ghost')`, `emailTag(label)` (étiquette), `emailPanel(html)` (encadré avec un trait de marque), `esc()` pour tout texte
  inséré. Couleurs dans `BRAND`, `ON_BRAND`, `BRAND_SOFT` : les mêmes valeurs que `--brand` / `--on-brand` de `globals.css`, à changer en même
  temps. Tables et styles en ligne, `color-scheme: light only`. Tous les modèles de `templates.ts` passent par là, sans emoji dans le corps.
- **Logo blanc sur fond transparent = invisible** sur le fond blanc d'un e-mail : le poser sur une pastille de la couleur de la
  marque (`background:<brand>;padding:6px;border-radius:10px` sur l'`img`) ou utiliser une version foncée. Contrôler dans
  l'aperçu « exemple de chaque e-mail » de l'admin, pas seulement dans le code.
- **Formulaire de contact** plutôt qu'un simple `mailto:` quand le client n'a pas de WhatsApp public : route `/api/contact`
  (zod, champ piège invisible qui répond « succès » sans rien envoyer, limite par IP et par adresse), e-mail vers `contact@` avec
  « Répondre à » = le visiteur, catégorie admin dans le journal. Sujets en pastilles (jamais de `<select>`), message de repli
  qui donne l'adresse e-mail si Brevo n'est pas encore branché.

## Leçons NERDS Academy (07/11/2026) : e-mails, pieds de page et signatures à faire pour CHAQUE client

Le client a reçu les 15 e-mails du site avec le bouton rouge et le nom en texte du kit : « aucun mail n'a la charte graphique ».
Les e-mails font partie de la charte, comme le site. À chaque nouveau SaaS (et à chaque audit), sans attendre qu'on le demande :

1. **Gabarit aux couleurs du client** : remplacer TOUTES les couleurs du kit dans `src/lib/email/templates.ts` (`grep -rn "C8102E"`
   dans `src` et `public` : rappels d'abonnement, facture PDF, `offline.html` aussi). Bouton plein de la couleur sombre de la charte,
   filet de la couleur ou du dégradé de marque en haut de la carte (`background:<couleur>` d'abord, puis `background-image:linear-gradient`,
   que Outlook ignore). Les e-mails écrits ailleurs (crons) passent par le même cadre (`emailLayout(body)` exporté de `templates.ts`).
2. **Vrai logo, centré**, en PNG (400 px de large, affiché à 170-180 px), servi par le site à une adresse ABSOLUE en dur
   (`https://<domaine>/marque/signature/<marque>.png`) : une adresse relative ou `localhost` ne s'affiche dans aucune messagerie.
   Il n'apparaît qu'après la mise en ligne qui publie le fichier : le dire au propriétaire.
3. **Bouton centré**, logo centré : c'est ce que le client attend d'un e-mail de marque.
4. **Pied de page** : bande de la couleur sombre de la marque, liens qui RAMÈNENT AU SITE (Mon espace, les offres, un outil gratuit,
   le blog), nom de la marque et de la maison mère, adresse du site. Pas de WhatsApp dans le pied d'un e-mail : on répond à l'e-mail
   (« Une question ? Répondez simplement à cet e-mail »), et `Répondre à` mène au Gmail du client par le routage.
5. **Gabarits de connexion** (`public/email-templates/*.html`) : même cadre, langue du site (une ligne dans l'autre langue si le
   public est bilingue), liens par `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup|recovery`.
6. **Vouvoiement ou tutoiement** selon le site, jusque dans le pied (le kit disait « Réponds »).
7. **Signatures Gmail** pour chaque adresse qui répond (fondateur, contact@, la plateforme) dans
   `PROJETS CLIENTS/<CLIENT>/GRAPHISME/SIGNATURES-EMAIL/` : un fichier par signature + `APERCU-SIGNATURES.html` à copier-coller dans
   Gmail. Tableau en styles en ligne : logo à gauche (150 px), filet vertical de marque, nom, fonction, puis une ligne par contact
   AVEC ICÔNE (WhatsApp avec son logo officiel vert, e-mail, adresse, site) : icônes PNG 64 px rondes aux couleurs de la marque,
   affichées à 18 px, hébergées dans `public/marque/signature/icones/` (Gmail n'affiche pas les SVG). Fabriquées par Chrome sans
   fenêtre (`--headless --default-background-color=00000000 --window-size=64,64 --screenshot`), logo WhatsApp tiré de `simple-icons`.
8. **Procédure « Envoyer en tant que »** (section ci-dessus) écrite pour le client dans le même dossier, en français simple.
9. **Contrôle** : rendre un e-mail en HTML puis capture (Chrome sans fenêtre, logo pointé en `file://` le temps de l'aperçu), puis
   « M'envoyer un exemple de chaque e-mail » après la mise en ligne. Les essais vont à l'adresse de l'admin connecté : une fois validé,
   plus aucun e-mail du client ne doit arriver sur l'adresse personnelle de Roosevelt (vérifier `ADMIN_NOTIFY_EMAIL` dans /admin/keys :
   l'adresse business du client).
