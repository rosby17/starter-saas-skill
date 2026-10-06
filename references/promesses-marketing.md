# Vérifier que la publicité dit vrai, avant le lancement

Appris de KappGen (06/10/2026). Le script de la pub listait 15 promesses ; à la vérification dans le code : 6 tenues, 6 en partie,
3 pas du tout (« il s'améliore tout seul », rapport par e-mail, notifications sur mobile). Elles ont été construites le jour même (2.1.0).

## Méthode
1. Récupérer le texte EXACT de chaque support (script de la pub, landing, fiche du store, e-mails) et en extraire chaque promesse, une par ligne.
2. Pour chacune : TENUE / PARTIELLE / NON TENUE, avec la preuve dans le code (fichier, fonction) et ce qui manque. Vérifier le
   comportement réel, pas un texte d'interface qui l'annonce (une option sans code derrière = NON TENUE). Un agent de lecture seule le fait bien.
3. Tableau au propriétaire, écarts les plus graves d'abord, et le choix : construire avant le lancement, ou retirer la phrase.
4. Noter dans le script de la pub une liste « à construire avant la mise en ligne », et la revérifier avant chaque campagne.
5. Les chiffres annoncés (taux, gains, « 24 h/24 ») doivent être mesurés : sinon, pas de chiffre.
