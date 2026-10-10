# Publication Atomique et Versioning

**Leçon de KappGen 2** : Déployer un SaaS sans casser la version existante nécessite une **publication atomique**. KappGen 2 utilise une stratégie en trois branche : `main` (développement), `production` (ce qui tourne), et versioning par étiquette git.

## Problème résolu

Sans publication atomique :
- ❌ Clients téléchargent une version mi-cuite
- ❌ Paquet signé ne correspond plus à ce qui est en ligne
- ❌ Rollback = cauchemar (modifier `version.json` et relancer, mais le paquet vieux est toujours téléchargeable)

## Solution : Publication atomique en trois étapes

### Étape 1 : Développement sur `main`

```bash
# Les sessions CloudClaude mergent des PR sur main
git merge pull/123

# Tests continuent, rien n'est publié
python3 -m unittest test_serveur  # ✅
```

**Règle** : Aucune publication n'est initiée depuis `main`. Roosevelt lance manuellement.

### Étape 2 : Création de version

```bash
# Roosevelt lance depuis un worktree propre sur origin/main
cd /tmp/kg-pub  # worktree ISOLÉ
python3 admin/version.py correctif "Titre" "Nouveauté…"
# Cela incrément la version (2.0.1, 2.1.0, etc.) dans:
# - api/kappgen2/__init__.py
# - installateur/dist/version.json (signé)
```

### Étape 3 : Publication atomique

```bash
python3 admin/publier.py correctif "Titre" "Nouveauté…"
```

Cela fait, **EN UNE SEULE COMMANDE** :
1. ✅ Vérifie que le worktree est propre (`origin/main`)
2. ✅ Lance la suite de tests complète (248 tests + test_serveur)
3. ✅ Crée un commit "Version X.Y.Z" sur une **branche temporaire**
4. ✅ Crée une **étiquette git** `vX.Y.Z`
5. ✅ **Reconstruit les installateurs** (Mac, Windows, Linux)
6. ✅ **Signe le paquet** (clé privée)
7. ✅ **Avance la branche `production`** au commit de version
8. ✅ **Pousse tout** : `main`, `production`, l'étiquette

Si **un test échoue** → Tout s'arrête, `production` ne bouge pas, la version reste la même. Zéro risque.

## Implémentation KappGen

```python
# admin/publier.py (simplifié)
def publier(type_version, titre, *nouveautes):
    # Vérifier qu'on est sur un worktree propre
    if repo_has_changes():
        raise "Le dossier de travail a des modifications"
    
    # Verrouiller (une seule publication à la fois)
    with verrou_publication():
        # Tests complets
        run_tests("test_coeur", "test_reseaux", "test_serveur")
        
        # Incrémenter la version
        increment_version(type_version)  # correctif, mineure, majeure
        
        # Commit de version
        commit(f"Version {version}: {titre}")
        
        # Créer l'étiquette
        tag(f"v{version}")
        
        # Reconstruire le paquet
        build_installers()
        sign_installers()
        
        # Avancer production
        branch_production = get_or_create_branch("production")
        branch_production.reset_to_current_commit()
        
        # Pousser tout
        git_push_all(["main", "production", "--tags"])
```

## Stratégie de rollback

Si une version publiée a un bug **découvert après** :

1. **Correctif rapide** sur `main`
2. **Version 2.0.2** (correctif)
3. **Publication 2.0.2** (avance production)
4. Clients upgraderont automatiquement (version.json dans installateur)

**Jamais** de manipulation manuelle de `version.json` ou de suppression de tags.

## Configuration requise

```ini
# .kappgen-publication.lock
/Users/MAC/Documents/dev/kappgen-2 · pid 12345 · 16:30
```

Verrou atomique : Une seule publication à la fois, même avec plusieurs sessions.

## Cas multi-serveurs (SaaS hébergé)

Pour un SaaS avec serveur actif pendant la publication :

1. **Branche production** = ce que les clients voient (Coolify, K8s, etc.)
2. **Publication** = tests + merge vers `production`, puis Coolify recrée le conteneur
3. **Attendre** que le nouveau déploiement soit up (vérifier health check)
4. **Version.json** toujours disponible, même pendant le redémarrage

## Avantages

✅ **Atomicité** : Tout ou rien
✅ **Traçabilité** : Chaque version = étiquette git
✅ **Sécurité** : Signature du paquet
✅ **Rollback** : Un git checkout + redéploiement (mais jamais utilisé en prod KappGen)
✅ **Parallélisation impossible** : Le verrou empêche deux publications simultanées

## Voir aussi

- `admin/publier.py` : Implémentation complète KappGen 2
- `admin/version.py` : Incrémentation de version
- `api/kappgen2/__init__.py` : Stockage de la version
- CLAUDE.md : "Mise en ligne (règle de Roosevelt, 06/10)"
