# Traduire un produit dans 12 langues (et ne rien oublier)

Appris de KappGen (06/10/2026) : 354 nouveaux textes à traduire dans 10 langues après une refonte. Méthode qui a marché, et pièges.

## Principe (chez KappGen, repris pour tout produit à interface écrite dans la langue du créateur)
- L'interface est écrite dans UNE langue (le français) ; un petit script la traduit à l'affichage avec un dictionnaire par langue (`langues/<code>.js`). **Clé = le texte français tel qu'affiché**, sans les espaces de bord ; `{0}`, `{1}` pour les parties variables (nombres, noms).
- **Repli** : un texte absent d'une langue s'affiche en ANGLAIS (jamais en français). Le français est donc la source, l'anglais la langue de référence complète, les autres suivent.
- Ajouter une langue à la liste proposée seulement quand son dictionnaire est complet.
- Pour un SaaS Next.js du modèle : même idée avec `next-intl` ou un dictionnaire clé = texte source ; le point important est la RÈGLE, pas l'outil.

## Règle de travail
1. Tout nouveau texte visible ajoute sa traduction ANGLAISE dans le même changement (jamais « on traduira plus tard »).
2. En fin de chantier, calculer ce qui manque dans chaque langue (clés de l'anglais absentes de la langue), puis traduire TOUT d'un coup.
3. Traduire à partir du français ET de l'anglais (le sens, pas le mot à mot) ; garder le ton de chaque dictionnaire déjà écrit (« vous » poli en allemand/russe/turc/japonais, « tu » en espagnol/italien, etc.).
4. **Cohérence des mots-clés** : un glossaire par langue pour les termes du produit (marque, charte, montage, routine, bibliothèque…) ; reprendre ce que le fichier emploie déjà.
5. Les noms propres et marques ne se traduisent pas (KappGen, YouTube, Claude, ChatGPT, iziVoice, Polaroid, Bokeh…).

## Outil de lot (à recréer, ~40 lignes)
Un fichier `<langue>.tsv` par langue, une ligne `index<TAB>traduction`, dans l'ordre de la liste des clés manquantes ; un script qui : vérifie que TOUS les index sont là, que les marqueurs `{n}` sont identiques à ceux de la clé, insère les lignes dans le dictionnaire, puis passe `node --check`. Ainsi aucun décalage ne passe inaperçu.

## Pièges rencontrés
- **Deux objets dans un fichier de dictionnaire** : `dictionnaire('en', { exacts }, { modèles avec {0} })`. Ajouter « avant la dernière accolade » plaçait les ajouts dans le SECOND objet (modèles) : ça fonctionnait (motif exact) mais c'était faux. Toujours insérer dans le premier objet ; compter les clés par objet.
- La dernière ligne d'un objet n'a souvent pas de virgule finale : en ajouter une avant d'insérer, sinon `SyntaxError`.
- Apostrophes : la clé est comparée telle quelle. `'` droite et `’` courbe sont deux clés différentes : reprendre EXACTEMENT celle du code.
- Deux textes français différents qui se traduisent pareil dans le même écran (Suivi / Supervision → « Monitoring ») : renommer l'un côté source.
- Un texte plus long dans une langue casse une barre (titre sur deux lignes, bouton coupé) : tester une langue longue (allemand) ET une écriture de droite à gauche (arabe) sur l'écran modifié.
- Un mot absent du contexte (« Terminées », « Fixe », « Cadre ») se traduit mal sans son écran : traduire avec la phrase de l'interface sous les yeux.
- Faire relire par un locuteur natif les langues peu courantes (hindi, arabe, turc, japonais) avant le lancement : une traduction faite par l'IA est correcte mais pas toujours naturelle.
