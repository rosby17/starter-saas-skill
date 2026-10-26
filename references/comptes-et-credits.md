# Comptes et crédits : tenir sa base de clients propre et faire recharger sans forcer

Leçons tirées de la production d'iziVoice (17-24/10/2026), portées dans le modèle le 26/10/2026. À appliquer à tout SaaS qui a des comptes gratuits (risque de comptes en série) et, pour la partie 2, à tout SaaS à l'usage (module `credits`).

## 1. Administration des comptes

### Segments : l'activité RÉELLE, pas la connexion

Erreur commise : « 2 400 utilisateurs » au tableau de bord, dont des centaines de comptes jetables jamais servis et des comptes suspendus. Le chiffre ne voulait rien dire.

- **Actif** = a consommé des crédits, payé une commande ou suivi une leçon dans les 30 derniers jours. Une simple connexion ne compte pas (un robot se connecte aussi). **Inactif** = déjà actif une fois, plus rien depuis. **Jamais actif** = rien du tout.
- **A dépensé** (payé ou consommé), **adresse suspecte** (domaine bloqué et non autorisé), **suspendu**, **interne** (équipe, testeurs, démo).
- Filtres combinables sur la liste, et un compteur « comptes ouverts » qui EXCLUT les suspendus : c'est le chiffre à montrer partout.
- Une seule définition des segments, pour la liste, les compteurs et les actions en lot (dans le modèle : la fonction SQL `admin_list_accounts`).

### « URI too long » : jamais de liste d'identifiants dans une URL

Erreur commise : une recherche courte (« gmail », « 237 ») renvoyait ~1 000 comptes ; tous les identifiants partaient dans un filtre `id=in.(…)` de l'API de données (une URL), PostgREST répondait « URI too long » et la page Utilisateurs tombait en 500. Reproduit : 968 identifiants cassent, les mêmes par paquets de 200 passent.

- Filtrer, compter et paginer **dans la base** (une fonction SQL appelée en RPC). Les identifiants cochés pour une action en lot partent dans le **corps** de l'appel RPC (`p_ids uuid[]`), jamais dans l'URL.
- Les données annexes (accès, commandes, e-mails) ne se lisent que pour les 30 lignes de la page affichée, jamais pour toute la base.
- Même famille de piège : l'API de données ne renvoie que **1 000 lignes** par défaut, sans erreur. Additionner un registre côté serveur donne un solde faux pour un client très actif : le solde se calcule en SQL (`credits_balance`).

### Recherche par téléphone

On cherche un numéro tel qu'on le lit sur WhatsApp : « +237 699 12 34 56 », « 0699123456 », « 699 12 ». Comparer **les seuls chiffres**, sans le `0` de tête, à partir de 3 chiffres.

### Actions en lot

- Cible : la sélection cochée, OU tout ce qui correspond au filtre courant (toutes les pages), avec un plafond (2 000) et le nombre affiché dans la confirmation.
- Actions : suspendre, réactiver, marquer / retirer « interne », bloquer un domaine (et suspendre ses comptes), « site sérieux : ne pas bannir ».
- Garde-fous : jamais son propre compte, jamais un administrateur ni un compte interne suspendu en lot ; refus de bloquer un fournisseur courant (gmail.com, outlook.com…), ce serait suspendre des milliers de clients honnêtes.
- Résultat chiffré : « 42 comptes traités · 40 e-mails envoyés · 2 ignorés ».

### Suspension : un motif choisi dans un menu, un e-mail préétabli

Erreur commise : un bouton « Suspendre » sec. Le client ne savait pas pourquoi, écrivait au support, et l'admin rédigeait la même réponse dix fois.

- Le bouton ouvre un **menu de motifs** (adresse jetable, domaine sans site, comptes en série, usage abusif, paiement contesté). Un clic = suspension + e-mail du motif, rien à rédiger. Le code du motif est gardé sur le profil et dans le journal d'audit.
- Le menu se rend **par-dessus la page** (portail) et se recale dans l'écran : positionné dans une carte ou un tableau qui défile, il était coupé. Fermeture au clic dehors ou par Échap, pas à la sortie de la souris.
- Plus de « Suspendre » sur chaque ligne de la liste (trop facile à cliquer par erreur) : depuis la sélection ou la fiche.
- La suspension = bannissement Supabase Auth (`ban_duration`), qui bloque la connexion ET le renouvellement de session. Le profil garde motif et date pour l'affichage.
- L'e-mail dit « nous », donne le motif, propose de répondre pour contester, et rassure : aucune donnée supprimée.

### Domaines jetables et sites sérieux

- Refus **côté serveur** à l'inscription (un contrôle dans le navigateur se contourne), avec un message qui aide la personne honnête : « Inscris-toi avec ton adresse habituelle. »
- Une table de règles par domaine : `blocked` (liste de départ + ajouts de l'admin) ou `allowed` (« site sérieux » vérifié : jamais classé suspect, même si le domaine est dans une liste publique : des petites entreprises y figurent par erreur).
- Les crédits de bienvenue ne sont jamais versés à une adresse bloquée (c'est précisément ce que cherchent les comptes en série).
- iziVoice utilise le paquet npm `disposable-email-domains` (> 100 000 domaines). Le modèle part d'une liste courte en base, pour rester sans dépendance ; pour un SaaS qui offre des crédits gratuits, installer le paquet et l'ajouter au contrôle de l'inscription.
- Non porté : la file d'**appels** (formulaire public « contester ma suspension » + file admin accepter / refuser). Dans le modèle, le client conteste en répondant à l'e-mail. À ajouter si les suspensions deviennent nombreuses.

### Fiche client en un clic

Partout où un client apparaît (liste, tableaux de statistiques, commandes), son **nom et son e-mail** sont des liens vers sa fiche. Un prénom ou un pseudo seul était illisible ; un clic sur la ligne entière sans vrai lien empêche d'ouvrir un nouvel onglet.

## 2. Crédits

### Proposer la recharge quand le solde baisse

- Sous un seuil réglable, une **petite carte** en bas de l'écran (qui ne bloque rien), en **teinte d'alerte** (rouge doux) pour être vue.
- **Un seul pack mis en avant**, choisi pour le client : celui qu'il achète d'habitude (12 mois), sinon le plus petit qui couvre sa consommation des 30 derniers jours, sinon le pack d'entrée. Les autres packs restent à un clic. « C'est celui qu'il a le plus de chances d'acheter. »
- Pas de fausse réduction, pas de compte à rebours. « Plus tard » la fait taire quelques jours (réglable).
- Mesurer : affichée (au plus une fois par 6 h), refusée, cliquée, payée. Le paiement est **rapproché à la lecture** (commande de crédits payée dans les 72 h d'un clic) : rien à écrire dans le circuit de paiement verrouillé.
- La recommandation ne doit jamais empêcher la carte : en cas d'échec, carte sans pack mis en avant.

### Gratuité temporaire d'un service (« illimité » jusqu'à une date)

Pour un lancement ou un essai : « tel service illimité pendant 2 heures ». Un réglage `{ services, until }` lu à chaque débit (cache de 15 s) : si le service y figure et que l'heure de fin n'est pas passée, rien n'est débité. La facturation revient **seule** à l'heure de fin (personne ne doit penser à la couper). En cas de doute (réglage illisible), facturation normale. Le client voit l'offre et sa fin sur sa page Crédits.

### Crédits ajoutés par l'admin : le client est prévenu

Erreur commise : des crédits offerts (geste commercial, remboursement, paiement reçu à la main) arrivaient en silence ; le client ne remarquait rien et le geste était perdu.

- Le motif saisi par l'admin est **visible par le client** (le formulaire le dit).
- Notification dans l'espace, **fenêtre « Tu as reçu des crédits »** à la prochaine visite (montant, motif, nouveau solde ; 14 jours au plus ; le « vu » est une date dans `user_metadata`, pas de table), e-mail en option.
- Les retraits aussi : le client sait pourquoi on lui a repris des crédits.

### Crédits de bienvenue réglables

Un montant et une durée de validité dans l'administration, pas une constante dans une migration (iziVoice a changé 5 fois de montant en trois mois, une migration à chaque fois). Une seule fois par compte (index unique), jamais pour une adresse jetable, et un réglage mal saisi n'empêche jamais une inscription.

### « Sans date d'expiration », pas « à vie »

Erreur commise : « Crédits à vie » était lu « utilisation illimitée à vie ». Écrire : « Sans date d'expiration : tes crédits restent jusqu'à ce que tu les utilises », et « Paiement unique, sans abonnement. Chaque utilisation consomme des crédits ; quand ton solde baisse, tu recharges. » Un prix de pack s'appelle « Prix (paiement unique) », jamais « Prix mensuel ».

## 3. Clés API des clients (non porté : le modèle n'en a pas)

Le modèle n'a pas d'API publique pour les clients. Le jour où un SaaS en ajoute une :
- chaque débit enregistre son **canal** (studio, API, MCP…) et la **clé** utilisée, pour TOUS les services (pas seulement le premier) ;
- tableau des clés : crédits consommés sur 30 jours par clé, avec une barre ;
- actions dans un menu ⋮ : afficher, copier (avec repli si le presse-papiers est refusé), révoquer. Afficher / copier exige une copie chiffrée de la clé (secret de chiffrement dédié) ; on ne stocke sinon que son empreinte ;
- **révoquer n'efface pas** : la clé expire tout de suite et reste listée « révoquée » avec sa consommation (35 jours), sinon ses débits se retrouvent orphelins et les chiffres par clé deviennent faux.

## Fichiers du modèle

- Migrations : `supabase/migrations/20261026120000_comptes_segments_domaines.sql` (profils `is_internal` / motif de suspension, `email_domain_rules`, `email_domain_blocked()`, `admin_list_accounts()`, `admin_account_counts()`), `20261026120100_credits_recharge_bienvenue.sql` (`credits.note`, réglages, `recharge_nudge_events`, `admin_recharge_nudge_stats()`, crédits de bienvenue, `credits_balance()`).
- Comptes : `src/lib/admin/accounts.ts`, `account-filters.ts`, `suspension-reasons.ts` ; `src/app/api/admin/customers/route.ts`, `bulk/route.ts`, `[id]/route.ts` ; `src/app/admin/customers/page.tsx` et `[id]/page.tsx` ; `src/components/admin/SuspendReasonMenu.tsx` ; contrôle du domaine dans `src/app/api/auth/signup/route.ts`.
- Crédits : `src/lib/credits/settings.ts`, `recommend.ts`, `balance.ts` (gratuité + solde SQL) ; `src/app/api/credits/recharge-nudge/route.ts`, `notices/route.ts` ; `src/components/credits/RechargeNudge.tsx`, `CreditNoticeModal.tsx` (branchés dans `src/app/(dashboard)/layout.tsx`) ; `src/app/(dashboard)/credits/page.tsx` ; `src/app/admin/credits/page.tsx` + `src/app/api/admin/credits/settings/route.ts` ; `src/app/api/admin/users/[id]/credits/route.ts` + `src/components/admin/CreditAdjustmentForm.tsx`.
- E-mails : `accountSuspendedTemplate`, `creditsAdjustedTemplate` (déclarés dans `EMAIL_EXAMPLES`).
- Menu de l'administration (`NAV` de `AdminNav.tsx`) : entrée « Crédits » → `/admin/credits`, avec `module: 'credits'`.
