# starter-saas : un skill Claude Code pour fabriquer un SaaS

Décris ton produit, Claude fabrique le SaaS : landing page, connexion et déconnexion, espace client, administration, tarifs, base de données (migrations automatiques), vérification et déploiement Docker. Le modèle contient déjà tout ce qui se répète d'un SaaS à l'autre : tu n'as plus qu'à parler de ce qui est propre au tien.

## Installer (une minute)

Il faut [Claude Code](https://claude.com/claude-code), Node.js 20+, Git, et un compte Supabase (gratuit) ; le CLI Supabase et Docker aident pour tester les migrations.

```bash
git clone https://github.com/rosby17/starter-saas-skill.git ~/.claude/skills/starter-saas
```

Ou, sans Git : télécharge le zip, décompresse-le pour obtenir un dossier `starter-saas` dans `~/.claude/skills/`. Ce skill est alors disponible dans toutes tes sessions.

## Utiliser

Dans Claude Code, écris par exemple :

> starter saas : une application pour que les coiffeurs gèrent leurs rendez-vous et envoient des rappels SMS. Abonnement mensuel.

(ou tape `/starter-saas`). Claude te fait un petit résumé, demande « on y va ? », puis crée le dossier, génère les pages et la base de données, teste, et te dit ce qui reste à faire (clés, nom de domaine).

## Ce que le modèle contient

- Landing, tarifs, FAQ, pages légales, SEO.
- Connexion, inscription, mot de passe oublié, déconnexion.
- Espace client (tableau de bord, mon compte, aide, abonnement) et administration.
- Migrations Supabase rejouables, sécurité par ligne partout.
- Passerelles de paiement (Maketou, Tara Money, Warappay, GeniusPay, K-Pay) et e-mails (Brevo), facultatifs.
- Dockerfile et route `/api/health` pour l'hébergement.

Le branding est dans `template/src/config/site.ts` et `template/src/lib/pricing.ts`.

## Mettre à jour

```bash
cd ~/.claude/skills/starter-saas && git pull
```
