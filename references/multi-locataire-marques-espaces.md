# Architecture Multi-Locataire : Marques et Espaces

**Leçon de KappGen 2** : Un SaaS peut servir plusieurs **entreprises** (marques), chacune avec ses propres **comptes réseau** (YouTube, Facebook, etc.) et son propre **espace de travail**. KappGen 2 implémente cela de manière flexible.

## Vocabulaire

- **Marque** (ou **Chaîne**) : Une entreprise/projet produit contenu (ex: "Lumière Divine" produit des vidéos de prière)
- **Réseau** : Plateforme social (YouTube, Facebook, TikTok, Instagram, Snapchat, X, LinkedIn)
- **Compte réseau** : Identité sur un réseau (ex: canal YouTube "Lumière Divine", page Facebook "Lumière Divine")
- **Espace** : Dossier de travail d'une organisation (contient toutes ses marques et contenus)

## Structure de l'espace (KappGen)

```
~/espace/
  espace.json           ← Configuration (nom, disposition, licences)
  chaines/              ← Marques (ou "brands")
    marque-01/
      chaine.json       ← Identité marque
      reseaux/          ← Comptes sur chaque réseau
        youtube.json
        facebook.json
      contenus/         ← Vidéos/posts
    marque-02/
  licences/             ← Clés de licence (KappGen, iziVoice, ChatGPT)
  consignes/            ← Directives globales
```

## Dispositions flexibles

KappGen supporte **deux dispositions** configurables dans `espace.json` :

1. **Disposition universelle** (nouvelle, recommandée)
   ```
   chaines/<id>/chaine.json
   chaines/<id>/contenus/
   chaines/<id>/consignes/
   ```

2. **Disposition héritée** (Roosevelt)
   ```
   ~/Motion/YOUTUBE/<NICHE>/<MARQUE>/ADN/chaine.json
   ~/Motion/YOUTUBE/<NICHE>/<MARQUE>/SCRIPTS/
   ~/Motion/YOUTUBE/<NICHE>/<MARQUE>/VIDEO/
   ```

Les **dossiers sont la vérité**, pas une base de données : le serveur indexe les dossiers dans une table SQLite, mais relit toujours le disque en cas de doute.

## Modèle de données (marque)

```json
{
  "id": "lumiere-divine",
  "nom": "Lumière Divine",
  "langue": "fr",
  "niche": "Religion",
  "sujet": "Prières et lectures bibliques",
  "rythme": "1 vidéo par jour",
  "heure": "18:00",
  "logo": "chemin/vers/logo.png",
  "reseaux": {
    "youtube": {
      "etat": "actif",
      "nom": "Lumière Divine",
      "compte": "@lumiere-divine",
      "lien": "https://youtube.com/@lumiere-divine"
    },
    "facebook": {
      "etat": "actif",
      "nom": "Lumière Divine",
      "compte": "lumiere.divine.official"
    },
    "tiktok": {
      "etat": "pause"
    }
  },
  "methode": {
    "montage": "transitions-douces",
    "musique": "ambient-spirituelle",
    "voix": "narrateur-profond"
  }
}
```

## États d'un réseau

- **Actif** : KappGen produit et publie du contenu
- **En pause** : Pas de publication ni d'alerte, compte et historique conservés
- **Non géré** : Réseau absent de la marque (pas de compte configuré)

## Avantages

✅ **Isolation** : Chaque marque = dossier isolé (sécurité, partition)
✅ **Flexibilité** : Ajouter une marque = créer un dossier
✅ **Extensibilité** : Passer de 1 à 100 marques sans refonte
✅ **Backup simple** : `tar` du dossier espace = backup complet
✅ **Migration** : Exporter/importer une marque = copier son dossier

## Implémentation dans un SaaS

1. **Inscription** → Créer dossier `espace/` unique, `espace.json`
2. **Créer marque** → Nouveau dossier `chaines/<id>` avec `chaine.json`
3. **Lier comptes réseau** → Mettre à jour `chaine.json` (ou fenêtre modale)
4. **Importer ADN** → Copier fichiers dans `chaines/<id>/ADN/`
5. **Lancer production** → CLI/API crée `chaines/<id>/contenus/video-001`

## Considérations de sécurité

- ⚠️ **Permissions disque** : Chaque espace = uid:gid dédié (empêche lecture crossover)
- ⚠️ **Isolation de processus** : Chaque marque peut avoir sa propre routine Claude
- ⚠️ **Chiffrement** : Clés iziVoice/ChatGPT = fichier `.env` ou secret du service, jamais en clair

## Voir aussi

- KappGen 2 CLAUDE.md : "Vocabulaire (décisions de Roosevelt)"
- `api/kappgen2/espace.py` : Classe `Espace` avec méthodes de gestion des marques
- `docs/ARCHITECTURE.md` : Schéma complet
