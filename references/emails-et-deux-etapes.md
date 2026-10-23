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
