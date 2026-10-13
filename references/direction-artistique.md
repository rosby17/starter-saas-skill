# Direction artistique : raisonner, s'inspirer, adapter

Le design d'un SaaS se DÉCIDE à partir du produit. L'inspiration nourrit la décision, elle ne la remplace pas.
On ne recopie jamais un site : ni ses textes, ni ses images, ni son logo, ni sa mise en page à l'identique.

## 1. Raisonner d'abord (avant de regarder quoi que ce soit)

Écris en 6 lignes, dans le `SPEC.md`, section « Direction artistique » :
- **Pour qui** : métier, âge, niveau à l'aise avec le numérique, pays (réseau mobile lent ? téléphone d'entrée de gamme ?).
- **Ce qu'il doit ressentir en 5 secondes** : confiance (argent, santé), énergie (création, jeunesse), calme (bien-être), sérieux (B2B, juridique), plaisir (grand public).
- **Niveau de prix** : gratuit / petit prix / premium. Un SaaS premium peut être épuré et éditorial ; un SaaS grand public doit être direct, chaleureux, rassurant.
- **Ce qui vend le produit** : une démo visible (interface, avant/après, vidéo), des preuves (chiffres, témoignages, logos), ou une promesse simple.
- **Contraintes** : la charte fournie (couleurs, police, logo), la langue, le poids de la page (mobile d'abord), l'accessibilité.
- **Style visé en 3 mots** (ex. « sobre, lumineux, rassurant »).

Ces 6 lignes servent de filtre : une référence qui ne colle pas à ce filtre est écartée, même si elle est belle.

## 2. Chercher l'inspiration

Source principale : **recent.design** (sélection quotidienne de sites et de motion design).

| Ce que je cherche | Adresse |
|---|---|
| Landing pages par secteur | `https://recent.design/websites?category=<saas, ai, startup, product, technology, finance, health, education, ecommerce, food-drink…>` (choisir le secteur le plus proche du produit, puis `saas`) |
| Animations, transitions, motion design | `https://recent.design/?category=motion` |
| Interfaces d'application (tableau de bord, écrans) | `https://recent.design/?category=interface` |
| Typographie, branding | `https://recent.design/?category=typography`, `?category=branding` |

Chaque fiche (`recent.design/i/…`) donne : une description, le **style** (Illustrative, Minimal, Long Scrolling…), les **couleurs**, les **interactions** (Scrolling Animation…), une vidéo, et le lien vers le site d'origine (Source). Ouvre la fiche, lis ces étiquettes, regarde la capture ou la vidéo, puis visite le site d'origine si la référence est retenue.

Autres sources si besoin : land-book.com, lapa.ninja, saaslandingpage.com, godly.website (motion très poussé).

Méthode : parcours 15 à 30 références, garde-en 6 qui passent le filtre du point 1, puis retiens-en **3 aux partis pris différents** (ex. une épurée, une illustrée, une très animée).

## 3. Proposer (dans le résumé « on y va ? »)

Pour chacune des 3 pistes : le lien, ce qu'on lui emprunte (structure du hero, rythme des sections, typographie, type d'animation) et POURQUOI ça sert CE produit et CE public. Dis aussi ce qu'on ne lui prend pas et pourquoi (trop lourd pour du mobile lent, trop froid pour du grand public…). L'utilisateur choisit une piste ou en mélange deux. S'il a déjà des sites qu'il aime (brief), pars d'eux.

Si l'utilisateur dit « choisis pour moi », choisis toi-même et justifie en une phrase.

## 4. Adapter

- La charte de l'utilisateur prime : on reprend une **structure** et une **intention**, pas des couleurs ni des images.
- Textes : ceux du vrai produit (bénéfices concrets, chiffres, témoignages réels ou laissés à remplir).
- Visuels : captures du vrai produit, illustrations ou photos libres de droits ; jamais une image du site d'inspiration.
- **Motion design** : au service de la compréhension (apparition des sections au défilement, démonstration du produit qui s'anime, compteur de chiffres, survol des boutons). Discret, 150 à 400 ms, rien qui bloque la lecture. Toujours désactivé avec `prefers-reduced-motion`. Pas de grosse bibliothèque ni de vidéo lourde dans le premier écran : CSS et `IntersectionObserver` d'abord ; Framer Motion seulement si une animation complexe le justifie.
- Performance : le premier écran doit s'afficher vite sur un téléphone moyen (images en `next/image`, polices via `next/font`).
- Note dans `SPEC.md` les références retenues et ce qui en a été tiré.

## 5. Ce qui DOIT changer d'un SaaS à l'autre (leçon AgedGmailYT, 13/10/2026)

Le client a reconnu tout de suite la mise en page du site de formation sur sa connexion, son pied de page et sa FAQ. Liste à repasser pour CHAQUE SaaS, même quand on garde le style (couleurs, police, sobriété) :

| Élément | Modèle (à ne pas livrer tel quel) | À faire |
|---|---|---|
| Connexion / inscription | `AuthUI` + `AuthHero` (écran partagé, briques, bandeau paiements/réseaux) | Mise en page propre ; Google → e-mail + mot de passe ; lien e-mail en option |
| Hero | `HomeHero` (titre géant à gauche, puces de domaines) | Dérivé de la piste choisie ou de l'ancien site du client |
| FAQ | `Faq` (« Les questions qu'on nous pose », liste à gauche) | Mise en page propre (grille de cartes, onglets par thème…) |
| Contact / pied de page | `Contact` (« On reste connectés », grille de réseaux, colonnes) | Bloc du canal choisi par le client + pied de page adapté |
| Preuves | Témoignages / photos d'exemple | Avis vérifiés réels ou chiffres réels en base, sinon une section « comment ça marche » |
| Visuels | Captures d'exemple | Captures du vrai produit (données de test masquées) |

Les briques fonctionnelles (paiement verrouillé, admin, espace client, e-mails) restent communes ; seule leur couleur suit la charte.
