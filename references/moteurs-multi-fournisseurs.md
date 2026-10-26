# Moteurs multi-fournisseurs : service → modèle → moteurs

Leçons tirées de la production d'iziVoice (octobre 2026 : soldes de deux fournisseurs épuisés le même matin, un compte muet, un fournisseur qui acceptait sans jamais terminer). À appliquer dès qu'un SaaS appelle une IA payante ; à vérifier dans tout audit (robustesse, rentabilité).

## 1. Le vocabulaire (une seule structure pour tout le SaaS)

- **Service** : ce que le client utilise (« Assistant IA », « Synthèse vocale », « Images »). Son nom apparaît à l'écran du client.
- **Modèle** : ce que le client choisit et paie dans ce service. Son nom ne change JAMAIS, quel que soit le fournisseur derrière.
- **Moteur** : le fournisseur qui sert réellement le modèle (un compte chez kie.ai, une API maison…). Un modèle peut être servi par plusieurs moteurs ; un moteur peut avoir plusieurs comptes.

Dans le kit : `src/lib/engines/catalog.ts` (`SERVICES` → `models` → `engines`, et `ENGINES`). Premier moteur branché : kie.ai (`src/lib/ai/kie.ts`), qui sert le modèle « Assistant (texte) » du service « Assistant IA ».

## 2. Noms de code : source unique

Partout à l'écran, administration comprise, un moteur s'appelle par son **nom de code** (« Alpha 1 », « Delta 2 »…), jamais par son fournisseur : une capture d'écran envoyée à un client ou à un autre fournisseur ne doit pas révéler qui fait tourner le SaaS.

- La correspondance n'est écrite QUE dans `src/lib/engines/codenames.ts` (`ENGINE_CODENAMES` + formes d'affichage à masquer).
- `maskProviders(texte)` remplace les noms des fournisseurs dans tout texte affiché (journal d'erreurs, causes, messages). Les identifiants internes, les variables (`KIE_API_KEY`) et les adresses d'API ne changent pas.
- Lettre grecque + numéro d'ordre, jamais réutilisé (un ancien numéro dans une capture doit rester sans ambiguïté).

## 3. Le moteur actif, la bascule automatique

- Chaque modèle a un **moteur actif**, choisi par l'admin (Administration › Moteurs IA, sélecteur aux couleurs du site). Par défaut : le premier moteur du modèle.
- **Bascule automatique COUPÉE par défaut** (règle de Roosevelt, 22/10/2026) : changer de moteur change le rendu, c'est une décision de l'admin. Coupée : si le moteur actif ne peut pas servir, le modèle est grisé. Activée : le premier autre moteur du modèle en état de servir prend le relais.
- Réglages dans `system_settings` (clé `engine_routing`), lus avec un cache de 15 s ; en cas de doute, aucune bascule.

## 4. Ne JAMAIS envoyer un client vers un moteur à sec

Incident iziVoice du 21/10/2026 : deux soldes épuisés, et des clients qui lisaient « nos moteurs n'ont pas pu traiter cette génération ».

- `src/lib/engines/health.ts` : un refus de compte (401, 402, 403) met le compte de côté 5 min ; quand TOUS les comptes d'un moteur refusent, le moteur entier est mis de côté. Le moteur suivant (si bascule), ou le modèle grisé, sans attendre l'échec suivant.
- `router.ts` : `resolveEngine(modelId)` = moteur à utiliser maintenant, ou `null` ; `unavailableModels()` = modèles à griser (publiés par `/api/system-status`, identifiants seulement).
- `guard.ts` : `serviceGate(service, modèle)` en tête de chaque route de l'espace client, AVANT tout débit : 503 calme (`model_unavailable` ou `service_closed`), « rien n'a été débité ».
- Bouton « Remettre en service » dans l'admin pour un moteur rechargé.
- État en mémoire : suffisant pour une seule copie de l'application (cas du kit).

## 5. Relais vers un autre compte du même fournisseur

Incident iziVoice du 18/10/2026 : le compte des voix personnelles ne répondait plus ; les autres comptes marchaient.

- Un moteur a une clé par compte (`KIE_API_KEY`, `KIE_API_KEY_2`…, déclarées dans `secrets/catalog.ts`). `runWithAccountRelay()` (`accounts.ts`) essaie le compte suivant si le compte refuse (401/402/403/429/5xx) ou si la connexion n'a jamais été établie.
- **On ne rejoue JAMAIS une demande peut-être reçue** (délai dépassé, coupure en cours de route) : double génération, double facturation. Seuls les refus explicites et les erreurs « jamais envoyées » passent au compte suivant.
- Une ressource propre à un compte (voix clonée, fichier déposé) n'a pas de relais : prévoir sa recréation ou un message clair.

## 6. Santé et sonde

- La page Erreurs affiche la santé des services (services en pause, modèles grisés, moteurs à sec) ; Moteurs IA affiche l'état de chaque moteur et de chaque compte.
- Sonde (supervision-exploitation.md § 3 bis) : une demande minuscule sur deux comptes ; deux échecs d'affilée = SEUL le service est mis en pause dans l'espace client, jamais le site ni l'API ; interrupteur dans l'admin (coupée par défaut) et `ENGINE_WATCHDOG=off`. Un moteur déclare sa sonde dans `ENGINES` (`probe.submit`, et `probe.read` pour un moteur à tâches).

## 7. Ajouter un moteur ou un service

1. Nom de code dans `codenames.ts` (+ formes d'affichage du fournisseur à masquer).
2. Clés dans `secrets/catalog.ts` et `secrets/services.ts` (une par compte).
3. Adaptateur : l'appel au fournisseur lève `EngineCallError(message, statut)` (ou `neverSent`) et passe par `runWithAccountRelay`. Sonde facultative.
4. Entrée dans `ENGINES`, puis son id dans `engines` des modèles qu'il sait servir.
5. Nouveau service : entrée dans `SERVICES` (`watch: true` pour la sonde) et `serviceGate()` dans ses routes.
6. Coût : ordre de grandeur dans `cost` (affiché à l'admin seulement).

## 8. Choisir un moteur de secours (méthode iziVoice, 19-20/10/2026)

- Un secours **indépendant** (autre fournisseur, autre infrastructure), pas un revendeur des mêmes modèles : une panne du fournisseur d'origine les emporte tous.
- Critère de prix fixé AVANT de chercher (ex. ≤ 10 $ le million de caractères) ; écoute ou lecture à l'aveugle avant de retenir.
- Pas d'auto-hébergement sur cartes graphiques tant que le volume ne le rentabilise pas (iziVoice : plus cher que le fournisseur principal, abandonné) ; un seuil de dépense mensuelle déclenche la réévaluation.
- Jamais de test payant sans accord chiffré.

## 9. Contrôles d'audit

1. Les noms de fournisseurs apparaissent-ils à l'écran (client ou admin) ? Une seule source de correspondance ?
2. Un moteur à sec peut-il encore recevoir des clients ? Le modèle est-il grisé, le message calme, rien débité ?
3. La bascule automatique est-elle une décision de l'admin (coupée par défaut) ?
4. Les comptes multiples d'un fournisseur se relaient-ils ? Un délai dépassé est-il jamais rejoué ?
5. Une panne du fournisseur ferme-t-elle seulement le service concerné, avec un interrupteur pour la sonde ?
