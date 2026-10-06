# Rendre un produit simple (sans perdre sa puissance)

Appris de KappGen (05-06/10/2026). Les amis testeurs ont tous dit la même chose : « trop de boutons, on ne comprend pas l'interface ».
Le produit avait toutes les fonctions et était illisible. La réponse n'a pas été d'enlever des fonctions : on les a **déplacées ou repliées**.
À appliquer à CHAQUE SaaS dès qu'il a plus de ~6 écrans, et dès la création (le modèle fournit les briques).

## Les 4 principes
1. **Une seule question par écran : « que veut faire la personne maintenant ? »** Tout le reste est caché ou déplacé.
2. **Divulgation progressive.** Chaque écran a une vue simple ; le détail est derrière un bouton (« Personnaliser », « Voir les détails », « Plus de réglages »). Les fonctions restent toutes là.
3. **Des valeurs par défaut intelligentes.** Si la personne ne touche à rien, le résultat est déjà bon. Un réglage qu'on peut pré-remplir ne se demande pas.
4. **Le langage de la personne, pas celui du système.** Jamais « rendu échoué » ni « pipeline incomplet » : « Cette vidéo a besoin de vous » + un bouton « Réessayer » + la marche à suivre.

## Les 7 gestes (dans l'ordre de rentabilité)
1. **Accueil à trois choses** : un gros bouton d'action principale (« Créer une vidéo »), ce qui se passe maintenant, les objets de la personne en cartes. Pas de KPI, pas de réseau, pas de fil d'activité, pas de « à régler » : une SEULE pastille ambre discrète « N éléments ont besoin de vous » si une action est vraiment requise.
2. **États réduits à 3 mots** : *En préparation / Prête / Besoin de toi* (+ *En pause*). Les états techniques (échec, retard, bloqué, en attente de…) se rangent dans ces trois-là ; le détail brut va derrière « Voir les détails ». Piège : deux libellés internes différents qui se traduisent pareil (Suivi / Supervision → « Monitoring ») : renommer l'un.
3. **Un interrupteur Simple | Avancé dans l'en-tête, visible sur TOUS les écrans** (pas caché dans les réglages), **Simple par défaut**. Une seule clé de préférence ; le menu est le même dans les deux modes, seul le niveau de détail des pages change. L'avancé garde exactement l'ancien écran (rien n'est supprimé). Modèle : `components/ViewMode.tsx` (`ViewModeProvider`, `ViewModeToggle`, `useViewMode`).
4. **Menu en groupes pliables par usage**, pas en liste plate ni en « mode simple qui cache la moitié ». Erreur commise et corrigée : on avait caché des entrées jugées secondaires (Routines, Bibliothèques) alors que le client les juge importantes. Règle : **on ne cache jamais une entrée, on la range** (Mon contenu / Automatisation / En coulisses). Le groupe de la page courante reste ouvert ; un point ambre sur un groupe replié s'il contient une alerte. Modèle : `site.dashboardNav` avec `group` et `advanced`.
5. **Assistant de création en 3 écrans** (nom + thème, style, canaux) au lieu de 8-9 étapes ; tout le reste prend une valeur par défaut (méthode conseillée, rythme, langue du navigateur…). Un lien discret « Réglages avancés » ouvre l'ancien assistant SANS perdre la saisie. Photo/logo en rond à côté du nom : le logo du produit par défaut, les initiales dès qu'un nom est tapé, la photo si elle est téléversée.
6. **« Premiers pas » à la place du tutoriel** : 3 actions qui se cochent TOUTES SEULES d'après l'état réel (« créer », « lancer », « voir avancer »), puis la carte disparaît pour de bon. Le tutoriel de première visite se réduit à « Bienvenue » → création. Modèle : `components/GettingStarted.tsx`.
7. **Chaque page en deux vues** : liste de cartes / un seul bouton principal + « Personnaliser » (page d'un objet), 3 pastilles au lieu de 6 filtres (production), agenda des 7 jours au lieu d'une frise zoomable (calendrier), « Publier » + « Textes à publier » (publication), un seul bouton « Programmer » au lieu d'un menu à 4 entrées (routines), « Plus de réglages » replié (réglages). L'ancienne page complète reste en Avancé.

## Méthode de travail
- Phase par phase, avec une capture avant/après de chaque écran, et validation avant de continuer. Ordre : 1 accueil + vocabulaire, 2 assistant, 3 premiers pas, 4 interrupteur, puis écran par écran.
- Vérifier dans un espace d'ESSAI (jamais sur les vraies données) en thème sombre ET clair, petit écran, et dans les autres langues (un texte plus long casse une barre : « Avancé » coupé).
- Tout nouveau texte : traduction dans TOUTES les langues proposées (voir `references/traductions.md`).
- Le test qui compte : refaire tester les mêmes personnes avec la question « as-tu lancé une vidéo (ou ton action principale) sans aide, en combien de minutes ? ».

## Pièges rencontrés
- Un texte d'accueil en « tu » dans un produit qui dit « vous » partout : choisir UN ton (note dans la charte du SPEC).
- Le défaut « Simple » doit être le comportement SANS préférence enregistrée (`!== 'avance'`), pas une valeur écrite au premier lancement.
- L'état de l'interrupteur se lit côté client après le premier rendu (premier rendu toujours en simple) : pas de décalage serveur/client.
- Un bouton « Fermer » ne suffit pas : la touche Échap et le clic hors fenêtre doivent fermer les fenêtres.
