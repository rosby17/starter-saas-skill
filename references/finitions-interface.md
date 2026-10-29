# Finitions d'interface : les détails qui font « pro »

Petits réglages qui, additionnés, séparent une interface « correcte » d'une interface soignée. À passer sur chaque écran avant
de livrer (et à l'audit, domaine 9). Repris du skill `make-interfaces-feel-better` d'ECC (affaan-m/ECC, licence MIT), adapté au kit.
Ils ne remplacent jamais la charte du produit : ils la finissent.

## Les règles
- **Arrondis emboîtés** : un bloc arrondi dans un autre → arrondi extérieur = arrondi intérieur + marge intérieure.
  Exemple : carte 8 px de marge, bouton 8 px d'arrondi → carte 16 px. Si la marge est grande, traiter les deux comme des surfaces séparées.
- **Centrage optique** : flèches, triangles « lecture », étoiles ne paraissent pas centrés au centre géométrique.
  Corriger le SVG, ou décaler de 1 à 2 px.
- **Bordure ou ombre, pour une raison** : la bordure sépare et sert d'anneau de focus ; l'ombre donne de la profondeur
  (menu, fenêtre, carte qu'on peut saisir). Ombres légères et transparentes, qui marchent en clair ET en sombre.
- **Retour à la ligne des titres** : `text-wrap: balance` sur les titres et textes courts, `text-wrap: pretty` sur les paragraphes
  courts et descriptions. Jamais sur le code ni sur les longs textes.
- **Chiffres qui bougent** : `font-variant-numeric: tabular-nums` sur compteurs, minuteries, prix, crédits et tableaux,
  sinon la ligne « danse » quand un chiffre change.
- **Lissage des polices (Mac)** : sur la racine, si absent : `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`.
- **Contour des images** : un contour neutre très léger empêche une image claire de se fondre dans le fond :
  `outline: 1px solid rgba(0,0,0,.1); outline-offset: -1px;` (blanc à 10 % en sombre). Jamais teinté de la couleur de la marque.
- **Animations** : transitions CSS pour les changements d'état (elles peuvent s'inverser en cours de route si la personne change d'avis),
  `@keyframes` seulement pour une entrée unique ou un chargement. Apparition : opacité + léger glissement vers le haut ;
  disparition plus courte (~150 ms) ; bouton pressé : `scale(0.96)`. Toujours coupées avec `prefers-reduced-motion`.
- **Jamais `transition: all`** ni `will-change: all` : lister les propriétés (`transform, background-color, box-shadow`).
  `will-change` seulement sur `transform` / `opacity` / `filter`, et seulement si la première image saccade.
- **Zone de clic** : au moins 40 × 40 px (idéal 44 × 44) pour tout bouton ou icône cliquable, agrandie par un pseudo-élément
  si l'icône est petite, sans que deux zones se chevauchent. Indispensable sur téléphone.

## Vérification rapide
```bash
grep -rnE "transition:\s*all|will-change:\s*all" src/ app/ interface/ 2>/dev/null
```
Puis à l'écran : un compteur qui change (chiffres fixes ?), une carte dans une carte (arrondis ?), un bouton icône sur téléphone
(se touche facilement ?), une image claire sur fond clair (contour ?), en clair et en sombre.

## Rapport (si on fait une passe de finitions)
| Règle | Avant | Après | Fichier |
|---|---|---|---|
| Chiffres | Le compteur de crédits bouge | `tabular-nums` | `components/credits.tsx` |
Ne lister que ce qui a changé.
