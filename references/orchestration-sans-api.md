# Orchestration sans API : Communication par fichiers

**Leçon de KappGen 2** : Quand plusieurs services ou routines planifiées travaillent ensemble, les APIs internes créent du couplage fort et des dépendances. KappGen utilise une approche **filesystem-based** pour l'orchestration sans API.

## Principes

- **Vérité dans les fichiers** : Chaque marque/entreprise = dossier avec `marque.json`, `contenus/`, `consignes/`
- **Claude/ChatGPT communiquent via fichiers** : Pas d'API, routines planifiées lisent/écrivent les fichiers
- **Extensibilité** : De nouvelles routines peuvent lire/écrire sans modifier le code serveur
- **Simplicité** : Pas de gestion de verrous réseau, de timeouts d'API, de retry logic complexe

## Implémentation

```
~/espace/
  chaines/
    brand-01/
      chaine.json          ← Identité marque (nom, réseaux, voix, méthode)
      ADN/                 ← Documents personnalisés
      contenus/            ← Vidéos, posts, états
        video-001/
          .kappgen.json    ← État publication (YouTube, Facebook, etc.)
          06-rendu/
            video.mp4
            miniature.jpg
            publication.md
      consignes/           ← Instructions Claude/ChatGPT
        consignes.md
        prompt-video.txt
```

## Utilisation dans un SaaS

**Scénario** : Service de contenu multi-marques avec routines externes (vidéo IA, transcription, mise à jour).

1. **Marque crée du contenu** : Un dossier `contenus/video-001/` est créé avec `publication.md`
2. **Routine vidéo (Claude/ffmpeg)** : Lit `publication.md`, génère vidéo, écrit dans `06-rendu/`
3. **Routine transcription (whisper)** : Lit `video.mp4`, écrit résultat dans `transcription.json`
4. **Extension Chrome/API serveur** : Lit l'état depuis `.kappgen.json`, publie sur réseaux
5. **Dashboard** : Affiche l'état du fichier, sans interroger d'API interne

## Avantages

- ✅ Routines planifiées **indépendantes** du serveur
- ✅ **Pas de contention réseau** entre services
- ✅ **Versionnage** simple (git, snapshots)
- ✅ **Récupération d'erreur** : Relancer la routine, elle reprend où elle s'était arrêtée
- ✅ **Traçabilité** : Chaque fichier est un historique

## Attention

- ⚠️ **Cas multi-serveurs** : Nécessite un NFS partagé ou synchronisation (Syncthing, rsync)
- ⚠️ **Concurrence** : Verrous simples (`marque.lock`) ou verrous distribués si plusieurs éditeurs
- ⚠️ **Scalabilité** : ~1000 marques OK ; >10k marques = penser à une DB (mais garder les fichiers comme source de vérité)

## Exemple de structure d'échange (Convention d'échange KappGen)

Voir `docs/CONVENTION-ECHANGE.md` dans KappGen 2 pour le détail complet : format `.kappgen.json`, états de publication, cycle de vie d'une vidéo.
