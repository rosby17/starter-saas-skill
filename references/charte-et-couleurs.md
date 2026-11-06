# Charte et couleurs : tenir les codes graphiques du client du premier coup

Leçon Ballon Viral (05-06/11/2026). Roosevelt a dû corriger à la main, écran après écran, ce qu'une méthode aurait évité : orange approximatif, badge Pro noir sur orange en thème clair, cadenas mélangés aux couronnes, logos remplacés par des initiales, cartes image dans une autre police que le site, barre de rubriques en double. Son verdict sur le kit : « ça n'excelle pas mes codes graphiques, beaucoup de trucs bancals ». Cette fiche se lit AVANT d'écrire la première ligne d'interface, et se repasse avant de livrer.

## 1. Relever la charte, jamais l'inventer

- Sources dans cet ordre : charte du client (PDF, `.ai`, dossier `PROJETS CLIENTS/<CLIENT>/GRAPHISME/`), son site actuel (lire les vraies valeurs dans le CSS, pas à l'œil sur une capture), son logo (pipette sur le fichier vectoriel), puis la référence qu'il cite. « Comme Cloudflare » veut dire les hex de Cloudflare (Ballon Viral : orange `#FF6633` et gris neutres), pas « un orange ».
- Tout est noté dans la section « Charte » du `SPEC.md` sous forme de jetons, avec la source de chaque valeur :

| Jeton | Rôle | Exemple Ballon Viral |
|---|---|---|
| `--brand` / `--brand-hover` | boutons pleins, liens forts | `#FF6633` |
| `--on-brand` (clair) / `--on-brand` (sombre) | texte et icône SUR la marque, un par thème | blanc / `--ink` |
| `--ink`, `--line`, `--soft` | texte, filets, fonds doux | gris neutres, jamais bleutés si la charte ne l'est pas |
| couleurs de sens | gagner / perdre / neutre, succès / erreur | vert / rouge / gris, identiques partout |
| police de titre et de texte | fichiers locaux sous licence libre | Satoshi |

- Une valeur absente de la charte se propose (3 palettes, étape 1 du SKILL) et se fait valider. Jamais choisie en silence.

## 2. Un jeton, jamais une valeur en dur

- Les composants n'emploient que `bg-brand`, `text-on-brand`, `text-ink`, `border-line`… Avant de livrer : `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(" src/components src/app --include=*.tsx` ne doit trouver que les images générées (next/og), qui lisent elles aussi les jetons depuis un seul fichier (`src/lib/og/assets.ts` sur Ballon Viral).
- Le texte posé sur la marque change avec le thème : on le décide une fois dans `--on-brand` et on le teste en clair ET en sombre (contraste ≥ 4,5:1). Ballon Viral : badge Pro et bouton « Passer Pro » en blanc sur orange en clair, en noir en sombre (`text-white dark:text-ink`), l'icône suit avec `currentColor`.
- Une correction de couleur demandée par le client devient un jeton ou une règle de la charte, jamais un patch sur un seul écran : sinon elle revient ailleurs.

## 3. Un concept, une icône, un composant

- Chaque idée récurrente a UN composant partagé : contenu réservé = `ProBadge` (la couronne du bouton « Passer Pro »), jamais un mélange cadenas / étoile / couronne. Le badge se pose à la place de la valeur cachée (le score exact) : pas de ligne d'explication en plus sous chaque élément.
- Mêmes couleurs de sens sur le site, les cartes image, les aperçus de partage et les e-mails (Ballon Viral : vainqueur vert, perdant rouge, nul gris, score en orange sur fond sombre).
- Un seul appel à l'action par page (« Obtenir le magazine · prix »), la caisse s'ouvre au clic. Pas de navigation en double (la barre de rubriques qui répétait les logos de l'accueil a été retirée).

## 4. Les vrais visuels, jamais des substituts

- Logos officiels pour les clubs, compétitions, partenaires, opérateurs de paiement et sponsors (Ballon Viral : `CompLogo.tsx`, `team-crests.ts`, logo officiel 1xbet en blanc). Jamais d'initiale dans un rond ni de logo redessiné.
- Fond, illustration ou motif propres au produit, dessinés pour lui (le fond « tableau tactique » de Ballon Viral), jamais repris d'un concurrent.
- Photos du public visé (règles de casting de la mémoire) ; une page sans photo prend la photo du sujet cité, sinon le grand logo.

## 5. Les images générées suivent la charte du site

Cartes à partager, aperçus Facebook / WhatsApp (`opengraph-image.tsx`), couvertures, factures : même police (fichier `.woff` chargé dans la route next/og), mêmes jetons, version claire et sombre si le site a les deux, logos réels. Une carte qui ne ressemble pas au site se voit tout de suite dans le fil Facebook.

## 6. Le « côté IA » à enlever

Repérés sur Ballon Viral et corrigés : slogans courts terminés par un point, dégradés violets génériques, titres tous centrés, cartes identiques en grille de trois. Ce qui a plu : étiquettes en capitales espacées, flèches, halos discrets, coins de 28 px sur les grands blocs, nom de marque gardé tel que le client l'écrit (BALLON VIRAL en capitales).

## 7. Vérifier avec les yeux avant de dire « fini »

Pour CHAQUE écran touché : capture en clair, en sombre et à 375 px, posée à côté de la charte (ou de la page du client). On regarde : la couleur exacte du bouton principal, le texte sur la marque, les badges, les logos, la police des titres, les doublons de navigation. Un écran pas regardé dans les deux thèmes n'est pas fini. Les cartes image s'ouvrent aussi (`/…/carte?theme=light` et `dark`).
