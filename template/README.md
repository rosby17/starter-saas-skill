# {{APP_NAME}}

SaaS généré avec le skill **starter-saas** (Next.js 15, Supabase, Tailwind, Docker).

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvre le lien d'installation `http://localhost:3000/setup?token=…` (le `SETUP_TOKEN` est dans `.env.local`). Docker Desktop doit être lancé : l'assistant démarre la base de données (Supabase open source, ports propres à ce projet dans `supabase/config.toml`), crée les tables et ton compte administrateur. Aucun compte Supabase à créer.

## Où changer quoi

| Je veux changer… | Fichier |
|---|---|
| Nom, slogan, menus, fonctionnalités, FAQ, e-mail de support, infos de facturation, logo | `src/config/site.ts` |
| Couleurs et police (charte graphique) | `src/app/globals.css`, bloc **CHARTE GRAPHIQUE** (+ `src/app/layout.tsx` pour une police Google) |
| Logo, icône d'onglet | `public/logo.svg` + `site.logo` ; `src/app/icon.png` (512×512) |
| Offres et prix | `src/lib/pricing.ts` |
| Clés des services (paiement, e-mails, tâches) | **dans l'admin** : `/admin/keys` « Clés et intégrations » |
| Passerelle active par moyen de paiement | **dans l'admin** : `/admin/payment-providers` |
| Base de données | une migration NEUVE dans `supabase/migrations/`, puis `supabase migration up` en local ; en ligne, elle passe à la prochaine mise en ligne complète |

## Premier démarrage

1. `/setup` : base de données et compte administrateur (voir plus haut).
2. `/admin/keys` : colle les clés signalées comme manquantes (bouton **Renseigner**). Elles sont actives tout de suite.
3. `/admin/payment-providers` : choisis la passerelle de chaque type de paiement.

## Mise en ligne

**Admin → Mise en ligne** (`/admin/deploy`), depuis ton ordinateur la première fois : avec les jetons Coolify (droit root), GitHub et Hostinger/Cloudflare collés dans `/admin/keys`, un clic fait tout : DNS (domaine, www, api), dépôt GitHub privé, **base Supabase installée sur ton serveur Coolify** (`api.<domaine>`, migrations, compte admin, réglages et clés recopiés), application, variables, tâches planifiées, construction, test HTTPS de `/api/health`. Ensuite « Redéployer », aussi depuis le site en ligne.
Image Docker (`Dockerfile`, build « standalone »).

## Paiements : comment ça marche

1. Le client choisit un **type** de paiement (Mobile Money, carte, PayPal, crypto), jamais une passerelle.
2. `POST /api/payment/checkout` : identité lue dans la **session**, prix lu dans le **catalogue serveur**, passerelle lue dans le **réglage admin**. La commande est enregistrée « en attente ».
3. Chaque passerelle est un adaptateur : `src/lib/payments/gateways/<id>.ts`.
4. Le crédit passe toujours par `creditPaidOrder` : atomique, jamais deux fois. Il est déclenché par le webhook signé, la vérification au retour du client ou la tâche de rattrapage.

**Ajouter une passerelle :**
1. Créer un fichier dans `gateways/` et l'enregistrer dans `gateways/index.ts`.
2. La lister dans `providers.ts` pour les types de paiement qu'elle accepte.
3. Déclarer ses clés dans `src/lib/secrets/catalog.ts` : elles apparaissent alors dans l'admin.
4. Ajouter une route webhook ou une vérification au retour.

## Sécurité

Déjà en place :
- sécurité ligne par ligne sur chaque table ;
- routes admin derrière `requireAdmin()` ;
- tâches automatiques derrière `CRON_SECRET` ;
- webhooks vérifiés par signature ;
- clés de l'admin chiffrées (AES-256-GCM, table `app_secrets` inaccessible depuis le navigateur) ;
- journal d'audit ;
- limitation du nombre de tentatives ;
- en-têtes de sécurité (`next.config.ts`).

Règles : jamais de secret dans Git ni dans le code, dépôt GitHub en privé.

Avant chaque mise en ligne :

```bash
npx tsc --noEmit
```

```bash
npm run build
```

```bash
npm audit --omit=dev
```
