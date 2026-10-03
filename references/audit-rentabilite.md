# Mode audit : rentabilité

But : dire au propriétaire, chiffres à l'appui, si son SaaS gagne ou perd de l'argent, où il en perd, et quoi changer
(prix, offres, limites, code). Un SaaS peut être sûr et solide et quand même perdre de l'argent à chaque client.

## 0. Règles

- **Chiffres réels, jamais inventés** : coûts du propriétaire (factures du serveur, de l'IA, des SMS, de la passerelle) ou pages de prix
  officielles des fournisseurs consultées le jour de l'audit. Les prix de l'IA et des passerelles changent souvent : ne jamais les citer de mémoire.
  Ce qui reste estimé est écrit comme une hypothèse, avec sa source.
- **Base de production en lecture seule et seulement avec l'accord du propriétaire** (nombre de clients, consommation moyenne). Sinon, demander
  les chiffres au propriétaire. Jamais de donnée personnelle de client dans le rapport : des totaux et des moyennes.
- **On recommande, le propriétaire décide** : un prix ou une offre ne se change pas dans le code sans son accord explicite.

## 1. Comprendre le modèle (5 minutes)

À partir du code (`pricing.ts`, pages de tarifs, webhooks, crons) et du propriétaire :
- **Ce que le client paie** : abonnement (mois, an), paiement unique, crédits, à l'usage. Devise, passerelles, frais de chaque passerelle.
- **Ce que chaque client coûte** : chaque fonction qui appelle un service payant (IA, SMS, WhatsApp, e-mails au-delà du gratuit, stockage, vidéo),
  ce qu'elle consomme par utilisation, et combien de fois un client l'utilise.
- **Ce que le SaaS coûte même sans client** : serveur, domaine, outils, abonnements des services.
- **Ce que donne le gratuit** : offre gratuite, essai, bonus d'inscription, parrainage, codes cadeaux.

## 2. Scanner automatique

```bash
python3 "<dossier du skill>/scripts/audit_rentabilite.py" <dossier> --sortie <dossier>/SCAN-RENTABILITE.md
```

Il cherche :
- les fonctions payantes (IA, SMS, WhatsApp…) ouvertes à tous ou sans limite par client ;
- les réponses d'IA sans longueur maximale et les modèles haut de gamme ;
- les crédits débités en deux temps (dépensables deux fois) ;
- les prix provisoires, une grande offre plus chère à l'unité, un gratuit trop proche du payant ;
- l'absence de rattrapage des paiements en attente, de mesure du parcours, d'e-mails et de relances ;
- les crédits gratuits donnés sans confirmation d'e-mail.

Il liste aussi les offres trouvées dans le code (prix, unités, prix par unité). Chaque ligne est un SIGNAL : on la confirme en lisant le code.
Il suit les appels de fonction en fonction, mais un contrôle caché ailleurs (middleware, base de données) lui échappe : le lire avant de conclure.

## 3. Calculer (le cœur de l'audit)

1. `python3 "<dossier du skill>/scripts/calcul_rentabilite.py" --modele > <dossier>/chiffres.json`.
2. Le remplir avec le propriétaire : coûts fixes, frais de paiement, et pour chaque offre le prix, les unités données, la consommation moyenne
   (base de production en lecture si accord, sinon estimation dite comme telle), le coût d'une unité, le coût fixe par client.
   - **Coût d'une unité d'IA** = jetons d'entrée et de sortie d'une action typique × prix du modèle par million de jetons (page de prix du
     fournisseur, ce jour-là), en comptant les étapes cachées (reformulation, recherche, nouvel essai après une erreur).
   - **Frais de paiement** : pourcentage et frais fixe de la passerelle réellement utilisée, retrait vers le compte bancaire compris.
3. `python3 "<dossier du skill>/scripts/calcul_rentabilite.py" <dossier>/chiffres.json --sortie <dossier>/CALCUL-RENTABILITE.md`.
   Il donne pour chaque offre :
   - la marge pour un client moyen ;
   - la marge pour un client qui consomme TOUT (le cas qui ruine) ;
   - le prix minimum qui tient la marge visée.

   Pour l'ensemble, il donne le point mort, le coût des comptes gratuits et le résultat du mois.

## 4. Revue manuelle

**Prix et offres**
1. Chaque offre payante garde au moins 70 % de marge pour un client moyen (logiciel), et reste positive pour un client qui consomme tout ?
2. Les grandes offres sont moins chères à l'unité que les petites (sinon personne ne les prend) ?
3. Les prix suivent le pouvoir d'achat du public visé (FCFA, mobile money) et les prix des concurrents ?
4. Une offre annuelle (2 mois offerts) ou un pack existe pour encaisser plus tôt et garder les clients plus longtemps ?
5. Le gratuit fait essayer sans suffire (souvent 5 à 15 % de la première offre), et il est limité dans le temps ou en volume ? Un essai « une fois par compte » se renouvelle sans fin avec de nouvelles adresses : le limiter aussi par appareil (ou par moyen de paiement).
5 bis. Les prix suivent le pouvoir d'achat de chaque région (ex. Afrique en FCFA, Europe en euros, Amérique du Nord plus cher, reste du monde au niveau Afrique), lus côté serveur d'après le pays (en-tête de Cloudflare), et le montant encaissé est celui affiché ?

**Coûts qui dérapent**
6. Toute fonction payante exige un compte, débite des crédits ou un quota AVANT l'appel, de façon atomique, et rend le crédit si l'appel échoue ?
7. Les longueurs (max_tokens, taille des fichiers, durée des vidéos, nombre de SMS) sont plafonnées ?
8. Le modèle d'IA est le moins cher qui donne un bon résultat ; les résultats identiques sont mis en cache au lieu d'être régénérés ?
9. Une alerte de dépense (plafond mensuel chez le fournisseur d'IA, de SMS) protège contre une facture qui explose ?
10. Les crédits gratuits ne se multiplient pas avec de faux comptes (confirmation d'e-mail ou de téléphone, un bonus par appareil) ?

**Argent perdu en route**
11. Un paiement réussi dont le webhook s'est perdu est rattrapé (vérification au retour, cron de rattrapage) ?
12. Les clients qui commencent un paiement sans le finir sont relancés (e-mail ou WhatsApp après 1 h puis 24 h) ?
13. Les abonnements arrivés à échéance sont relancés avant de couper (indispensable quand le renouvellement n'est pas automatique : e-mail quelques jours avant, une seule fois), et l'accès est bien coupé après (pas de service gratuit oublié) ?
14. Les remboursements et litiges sont suivis (pas de crédits gardés après un remboursement) ?

**Croissance**
15. Le parcours visite → inscription → premier usage → paiement est mesuré, avec le taux de passage à chaque étape ?
16. Le premier usage arrive vite après l'inscription (moins de 2 minutes jusqu'au premier résultat utile) ?
17. Les e-mails de base existent : bienvenue, reçu de paiement, solde bas, relance d'inactivité ?
18. Le site présente clairement le prix, ce qu'on obtient, et une raison de payer maintenant ?

## 5. Classer

| Niveau | Définition | Exemple |
|---|---|---|
| **CRITIQUE** | On perd de l'argent maintenant, ou n'importe qui peut faire exploser la facture | fonction d'IA ouverte sans compte, offre à marge négative |
| **HAUTE** | Perte probable dès qu'il y a du monde | crédits dépensables deux fois, aucune limite par client, prix provisoires, marge sous 40 % |
| **MOYENNE** | Argent laissé sur la table | pas de relance, pas de mesure, grande offre mal calibrée, pas d'offre annuelle |
| **BASSE** | Optimisation | modèle d'IA un peu trop cher, textes de la page tarifs |

## 6. Rapport : `AUDIT-RENTABILITE.md` à la racine du projet

En tête, pour le propriétaire (non technique) :
- une note globale (A à E) ;
- le résultat du mois en une phrase (« tu gagnes / perds X FCFA par mois ») ;
- le point mort (« il te faut N clients payants ») ;
- les 3 changements qui rapportent le plus, chiffrés (« passer Pro à 7 500 FCFA : +X par mois »).

Puis, pour chaque point :
- **Titre** et **niveau** ;
- **Où** (fichier:ligne, ou « modèle économique ») ;
- **Ce que ça coûte**, en argent par mois si possible ;
- **Correction**, en code ou en décision ;
- **Statut**.

Joindre le tableau du calcul et les hypothèses (source de chaque coût). Terminer par « Vérifié sans problème ».

## 7. Corriger (après UN accord)

- **Code** (limites, débit atomique, plafonds, rattrapage, relances, mesure) : branche `audit/rentabilite`, un commit par correction, migrations neuves.
  Pour un SaaS fait avec ce kit, le débit atomique existe déjà : `debitCredits()` (`src/lib/credits/balance.ts`), à appeler AVANT l'appel payant.
- **Décisions** (prix, contenu des offres, gratuit) : seulement celles validées par le propriétaire, dans `pricing.ts`, puis vérifier les pages
  tarifs et le checkout.
- Revérifier : `tsc`, lint, build, les trois scanners, et relancer le calcul avec les nouveaux prix. Donner la note et le résultat du mois avant / après.
