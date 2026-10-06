# Sur téléphone : ne jamais laisser quelqu'un coincé

Appris de KappGen (06/10/2026). Sur mobile, le propriétaire est tombé sur la page de vérification d'un paiement et n'a pas pu revenir en
arrière ; et le menu n'était qu'une colonne d'icônes : « on ne sait pas à quoi correspondent les icônes », il ne trouvait pas « Mes marques ».

## Les règles
1. **Toujours un chemin de sortie.** Sur CHAQUE écran où l'on est connecté : un bouton ☰ (menu) et, hors de l'accueil, une flèche ←.
   Les pages autonomes (retour de paiement, facture, message, erreur) ont un « ← Mon compte » visible tout le temps — pas seulement
   quand le traitement est fini (le bouton « Voir mon abonnement » n'apparaissait qu'à la fin d'une vérification qui pouvait traîner).
2. **Le menu se déplie avec les noms**, comme sur ordinateur : ☰ ouvre un tiroir de ~272 px avec les groupes et les noms des pages,
   un voile derrière ; il se ferme par un lien, le voile ou un changement de page. Sous 560 px, plus de rail d'icônes : le contenu prend
   toute la largeur.
3. **Le titre de la barre = le nom de la page** (pas le nom du groupe), coupé avec « … » s'il est long.
4. **Pas de grille de 10 langues** : un menu déroulant maison d'une ligne (« 🌐 Français ▾ »), aux couleurs de la charte, jamais un `<select>`.
5. **Vérifier chaque page à 375 px** avant de livrer : aucune ne doit dépasser la largeur de l'écran. Petit script à lancer dans la
   console, page par page :
   `[...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 2)` doit être vide.
6. Les en-têtes de page (titre + bouton) passent en colonne sous 560 px ; les cartes réduisent leur marge.

Modèle : `template/src/components/DashboardShell.tsx` (☰, ←, tiroir, voile).
