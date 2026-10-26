# Coach business et fil d'activité : savoir quoi faire chaque matin, voir ce qui se passe en direct

Leçons tirées d'iziVoice (PR #270, #281, 21-23/10/2026). Deux pages d'administration livrées dans le modèle : `/admin/coach` et `/admin/activite`.

## Pourquoi

- **Fil d'activité** : un matin, deux moteurs étaient à sec et le tableau de bord ne montrait que les réussites. Le fondateur a découvert la panne par les clients. Il faut voir CHAQUE action (réussie, échouée, en cours, bloquée), qui l'a faite et d'où, sans ouvrir la base.
- **Coach** : le fondateur avait les chiffres mais ne savait pas quoi faire. Ce qu'il a demandé, c'est « je vois tout ce qu'il faut comprendre rapidement et je sais quoi faire exactement ». Il ne veut pas un tableau de plus : il veut une checklist du jour, des messages prêts à envoyer et des prompts prêts à donner au développeur.

## Comment (dans le modèle)

### Fil d'activité
- Table `activity_events` (migration `20261026110000_fil_activite.sql`) : action (clé stable), phrase, source (site, api, admin, paiement, systeme), statut (running, succeeded, failed, cancelled), montant, texte long `detail`, `error`, `metadata`, `parent_id` (étapes d'une action longue), `ref_table` / `ref_id` (objet relié). RLS : lecture admin seulement, écriture serveur.
- **Inscriptions et commandes notées par la base** (déclencheurs sur `profiles` et `orders`) : la brique de paiement verrouillée n'est pas touchée, et rien ne passe à côté (compte créé au paiement, Google…). Une commande crée une ligne « en attente » qui se termine payée, échouée ou annulée.
- Le reste se note avec `recordActivity()` de `src/lib/activity/record.ts` (ne lève jamais). Action longue : `startActivity()` → étapes avec `parentId` → `finishActivity()`. Déjà branché : nouvelle demande (`/api/requests`), inscription échouée (`/api/auth/signup`). Pour un SaaS à crédits, ajouter une ligne après chaque `debitCredits()` (action `credits.debit`, montant = crédits, `detail` = la consigne du client) et une ligne en échec si le travail payant échoue.
- Toute nouvelle clé d'action se déclare dans `ACTION_LABELS` (`src/lib/activity/types.ts`) ; tout nouvel objet relié dans `refHref()`.
- Écran : chiffres du jour (actions, réussite, échecs et blocages, clients actifs, encaissé), un clic sur un chiffre filtre la liste ; filtres période / statut / source / action ; direct toutes les 20 s avec pause ; nouvelles lignes surlignées ; « N étapes » déplie une action longue ; « Lire » ouvre le texte complet, l'erreur et le lien vers la fiche. Le texte long n'est chargé qu'à l'ouverture (`/api/admin/activity/item`).

### Coach
- Clé `ANTHROPIC_API_KEY` dans `/admin/keys` (service « Anthropic (Claude) »). Modèle `COACH_MODEL` (par défaut `claude-sonnet-5-5`), modèle de secours `COACH_FALLBACK_MODEL` (par défaut `claude-opus-5-5`), puis kie.ai (`KIE_API_KEY`) en dernier recours. Les trois se changent sans redéployer.
- **Point du jour** (`src/lib/coach/daily.ts`) : généré à la première ouverture de la journée (heure de `site.timezone`), en arrière-plan (`after()`), gardé dans `system_settings` (`coach_daily`). Contenu : phrase d'état, 2-3 phrases à comprendre, 3 à 5 actions classées par rentabilité (contacter, développer, configurer, acheter, surveiller), objectifs chiffrés par levier, client idéal, idées tirées du comportement avec leur prompt.
- **Checklist progressive** : anneau de progression, une seule tâche ouverte, la suivante s'ouvre quand on coche ; les cases cochées nourrissent le suivi du lendemain.
- **Actions « contacter »** : le modèle choisit un GROUPE (paniers abandonnés, inscrits jamais acheteurs, anciens acheteurs, fidèles, crédits presque épuisés) ou des « Client 3 » précis ; les vrais clients sont retrouvés chez nous. E-mail groupé (tout sélectionner, une confirmation, quota gardé, chaque client marqué « contacté »), WhatsApp manuel par lien pré-rempli, « Ignorer » (le client sort des listes ET des groupes comptés), « Sa réponse » : le coach analyse la réponse (motif, intention, suite, date de relance, leçon) et ne repropose pas le client avant la date.
- **Messages aux clients au « nous »** (`clientMessageStyle()`) : corps au nom de l'équipe, vouvoiement, pas d'emoji, signature NOMINATIVE ajoutée par l'e-mail (`coachMessageTemplate`), en français ou en anglais. Signature, contacts, objectif et contexte : bouton « Réglages du coach » (clé `coach_settings`, valeurs par défaut tirées de `site.ts`).
- Questions libres : `/api/admin/coach/ask`, réponse courte + cartes + priorités + questions suivantes.

## Pièges appris sur iziVoice

1. **Appel en flux, délai long.** Sans flux, la limite de 120 s coupait Claude en pleine rédaction du point du jour, puis le SDK relançait deux fois la même demande payante. Ici : `messages.stream(...).finalMessage()`, 10 min, une seule relance.
2. **Réponse coupée = JSON invalide.** `stop_reason: "max_tokens"` ou `"refusal"` : on passe au moteur suivant au lieu d'essayer de lire un JSON tronqué.
3. **Contrôle tolérant.** Un champ un peu trop long faisait rejeter tout le point du jour (« Réponse illisible ») : analyse payée pour rien. Couper / écrêter, ne refuser que l'inutilisable.
4. **Pas de relance en boucle.** Après un échec, pas de nouvel essai automatique avant 30 min (chaque essai coûte) ; l'échec part au journal d'erreurs avec sa cause et la marche à suivre.
5. **Une seule génération à la fois** (promesse partagée) : deux onglets ouverts ne paient pas deux analyses.
6. **Jamais d'identité chez le modèle.** Nombres, groupes comptés, « Client N ». E-mails et numéros retirés des réponses clients avant analyse.
7. **Le bon message au bon groupe.** Des clients avec un gros solde recevaient « rechargez votre compte ». Le prompt l'interdit et les groupes sont séparés.
8. **Relire avant d'écrire.** L'envoi groupé et l'analyse d'une réponse prennent du temps : relire l'état juste avant d'enregistrer, sinon une case cochée pendant l'envoi est perdue.
9. **Fil : les échecs d'abord.** Un tableau qui ne montre que les réussites cache les pannes. Une ligne « en cours » trop vieille passe « bloquée ».
10. **Ne jamais nommer un fournisseur à l'écran** dans ce que voit un client ; le prompt du coach parle des « moteurs ».

## Fichiers du modèle

- Migration : `template/supabase/migrations/20261026110000_fil_activite.sql`
- Activité : `src/lib/activity/{types,record,feed}.ts`, `src/app/api/admin/activity/route.ts`, `src/app/api/admin/activity/item/route.ts`, `src/app/admin/activite/{page,ActivityFeed}.tsx`
- Coach : `src/lib/coach/{ai,settings,persona,snapshot,daily,replies,contacts,message}.ts`, `src/app/api/admin/coach/{daily,daily/email,replies,ask,settings}/route.ts`, `src/app/admin/coach/{page,CoachBoard,CoachQuestions,CoachSettingsButton,types}.tsx|ts`
- E-mail : `coachMessageTemplate` + exemple dans `src/lib/email/templates.ts`
- Clés : `ANTHROPIC_API_KEY`, `COACH_MODEL`, `COACH_FALLBACK_MODEL` dans `src/lib/secrets/catalog.ts` et `services.ts` (logo `public/logos/services/anthropic.svg`)
- Dépendance : `@anthropic-ai/sdk`
