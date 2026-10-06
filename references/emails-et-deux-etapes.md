# E-mails qui arrivent vraiment, et validation en deux étapes au choix

Appris de KappGen (06/10/2026), le jour du lancement : le site affichait « Code envoyé » alors qu'AUCUN e-mail ne partait depuis le début
(clé Brevo invalide, 401 « Key not found »). Personne ne le voyait : l'envoi se faisait en arrière-plan et l'échec n'était noté que sur le serveur.

## E-mails
1. **Un e-mail dont la personne a besoin tout de suite (code de connexion, lien de mot de passe) s'envoie en ATTENDANT la réponse du
   fournisseur** ; en cas d'échec, l'écran dit la vraie raison (« Le code n'a pas pu être envoyé par e-mail : … Utilisez l'application
   d'authentification »), jamais un faux « envoyé ». Les autres (reçus, rapports) peuvent partir en arrière-plan.
2. **Journal des e-mails dans l'admin** : sujet, destinataire, heure, « Envoyé » / « Échec » + la réponse exacte du fournisseur.
3. **Bouton « M'envoyer un exemple de chaque e-mail »** dans l'admin : chaque modèle part à l'adresse de l'administrateur seulement,
   sujet préfixé « [Exemple] », données fictives et liens inoffensifs, avec le résultat de chaque envoi. À cliquer AVANT le lancement et
   après tout changement de clé.
4. **Jamais un secret dans le SUJET** (code, lien) : les sujets sont journalisés et visibles dans l'admin. Le code va dans le corps.
5. **N'envoyer que l'utile** (décision de Roosevelt) : pas d'e-mail de bienvenue ni d'alerte « nouvelle connexion » ; chaque envoi coûte.
6. **Tests** : ne jamais laisser un test appeler le vrai fournisseur. Remplacer l'envoi sur l'INSTANCE de test (`site.envoyer_courriel = …`,
   `site.courriel_actif = lambda: True`), jamais en modifiant une fonction du module pour tous les tests (un test l'avait fait : un vrai
   appel est parti vers Brevo).

## Validation en deux étapes
- **Au choix** dans Sécurité : « Par e-mail » (le plus simple) ou « Avec une application » (Google Authenticator, Microsoft Authenticator,
  Authy : marche sans Internet). Le même écran de connexion, avec un texte adapté à la méthode.
- **Code par e-mail** : 6 chiffres, valable 10 minutes, usage unique, stocké haché, remplacé par chaque nouvel envoi, 6 envois par heure au
  plus ; essais comptés en base (8 en 10 min, 20 en 24 h). « Renvoyer un code » à l'activation ; pour les actions sensibles (désactiver,
  nouveaux codes de secours, changer d'adresse) un bouton « Recevoir un code par e-mail ».
- **Connexions sans page** (extension, API) : sans code, on envoie le code par e-mail et on répond « un code vient d'être envoyé ».
- **Codes de secours** dans les deux cas (8 codes, usage unique, montrés une seule fois). Conseiller de les garder hors de l'ordinateur ;
  si on les range sur le poste, dans un fichier privé (droits 600) HORS du dépôt git, jamais commité.
- **Prudence à l'activation par e-mail** : vérifier d'abord que les e-mails partent (bouton d'exemples), sinon proposer l'application.
- L'administration exige la deuxième étape (adresse d'admin ET adresse confirmée ET deuxième étape active).
