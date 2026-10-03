#!/usr/bin/env python3
"""Scanner de sécurité d'un SaaS (première passe automatique du mode audit du skill starter-saas).

Usage : python3 audit_securite.py <dossier-du-projet> [--sortie rapport.md]

Il ne modifie RIEN et n'exécute aucun code du projet (pas de npm install, pas de build).
Il repère des signaux ; chaque signal se confirme ensuite en lisant le code (voir references/audit-securite.md).
Niveaux : CRITIQUE (exploitable tout de suite), HAUTE, MOYENNE, À VÉRIFIER (soupçon à confirmer à la main).
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

IGNORE_DIRS = {'node_modules', '.git', '.next', '.next-dev', 'dist', 'build', 'out', '.vercel', '.turbo', 'coverage', 'vendor', '.venv', 'venv', '__pycache__', '.supabase', '.temp'}
CODE_EXT = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'}
ORDER = ['CRITIQUE', 'HAUTE', 'MOYENNE', 'À VÉRIFIER']

findings = []


def add(level, category, title, where, detail, fix):
    findings.append({'niveau': level, 'categorie': category, 'titre': title, 'ou': where, 'detail': detail, 'correction': fix})


_GIT_FILES = {}


def files(root, exts=None):
    # Projet Git : seulement le vrai code (fichiers suivis ou non ignorés), jamais les dossiers de build.
    if (root / '.git').exists():
        if root not in _GIT_FILES:
            _, out, _ = run(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], root)
            _GIT_FILES[root] = [root / f for f in out.splitlines()]
        for p in _GIT_FILES[root]:
            if any(part in IGNORE_DIRS or part.startswith('.next') for part in p.relative_to(root).parts[:-1]):
                continue
            if p.is_file() and (exts is None or p.suffix in exts):
                yield p
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS and not d.startswith('.next')]
        for name in filenames:
            p = Path(dirpath) / name
            if exts is None or p.suffix in exts:
                yield p


def read(p):
    try:
        return p.read_text(encoding='utf-8', errors='ignore')
    except OSError:
        return ''


def rel(root, p):
    return str(p.relative_to(root))


def line_of(text, index):
    return text.count('\n', 0, index) + 1


def run(cmd, cwd, timeout=300):
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout, r.stderr
    except (OSError, subprocess.TimeoutExpired) as e:
        return 1, '', str(e)


# ---------------------------------------------------------------------------
# 1. Secrets
# ---------------------------------------------------------------------------
SECRET_PATTERNS = [
    ('Clé Stripe live', r'sk_live_[0-9a-zA-Z]{20,}'),
    ('Jeton GitHub', r'gh[pousr]_[0-9A-Za-z]{30,}'),
    ('Clé AWS', r'AKIA[0-9A-Z]{16}'),
    ('Clé privée', r'-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----'),
    ('Jeton Supabase (gestion)', r'sbp_[0-9a-f]{40}'),
    ('Clé OpenAI / Anthropic', r'sk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}'),
    ('JWT (clé service Supabase ?)', r'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'),
    ('Clé Google API', r'AIza[0-9A-Za-z_-]{35}'),
    ('Clé Brevo', r'xkeysib-[0-9a-f]{64}-[0-9A-Za-z]{16}'),
]


def check_secrets(root):
    git = (root / '.git').exists()
    tracked = []
    if git:
        _, out, _ = run(['git', 'ls-files'], root)
        tracked = out.splitlines()
        for f in tracked:
            name = f.split('/')[-1]
            if re.fullmatch(r'\.env(\..+)?', name) and not name.endswith(('.example', '.sample', '.template')):
                add('CRITIQUE', 'Secrets', 'Fichier de variables suivi par Git', f,
                    'Ce fichier .env est dans le dépôt : toutes ses clés sont lisibles par quiconque a accès au code (et restent dans l’historique).',
                    'Le retirer de Git (git rm --cached), l’ajouter au .gitignore, et RÉGÉNÉRER toutes les clés qu’il contenait.')
    if shutil.which('gitleaks'):
        report = Path('/tmp') / f'gitleaks-{os.getpid()}.json'
        cmd = ['gitleaks', 'git' if git else 'dir', '--no-banner', '--redact', '--report-format', 'json', '--report-path', str(report), str(root)]
        run(cmd, root, timeout=600)
        try:
            leaks = json.loads(report.read_text() or '[]')
        except (OSError, json.JSONDecodeError):
            leaks = []
        report.unlink(missing_ok=True)
        seen = set()
        for leak in leaks:
            key = (leak.get('File'), leak.get('RuleID'))
            if key in seen:
                continue
            seen.add(key)
            where = f"{leak.get('File')}:{leak.get('StartLine')}" + (f" (commit {leak.get('Commit', '')[:7]})" if leak.get('Commit') else '')
            if re.search(r'(^|/)\.env\.(example|sample|template)$|test|fixture|mock', leak.get('File', ''), re.I):
                continue
            add('CRITIQUE', 'Secrets', f"Secret dans le code ou l'historique Git ({leak.get('RuleID')})", where,
                'Un secret a été écrit dans un fichier suivi par Git. Même supprimé depuis, il reste dans l’historique.',
                'Révoquer et régénérer ce secret chez le fournisseur, puis le lire depuis une variable d’environnement.')
    else:
        for p in files(root):
            if p.suffix in {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.mp4', '.pdf', '.lock'} or p.name == 'package-lock.json':
                continue
            if re.search(r'\.env\.(example|sample|template)$', p.name):
                continue
            text = read(p)
            for label, pat in SECRET_PATTERNS:
                for m in re.finditer(pat, text):
                    add('CRITIQUE', 'Secrets', f'{label} écrit en dur', f'{rel(root, p)}:{line_of(text, m.start())}',
                        'Un secret est écrit dans un fichier du projet.',
                        'Le révoquer, le régénérer, et le lire depuis une variable d’environnement.')
                    break
    gi = read(root / '.gitignore')
    if git and not re.search(r'^\.env', gi, re.M) and not re.search(r'^\*\.env|^\.env\*', gi, re.M):
        add('MOYENNE', 'Secrets', '.env non ignoré par Git', '.gitignore',
            'Rien n’empêche de commiter un fichier .env par erreur.', 'Ajouter `.env*` puis `!.env.example` au .gitignore.')


# ---------------------------------------------------------------------------
# 2. Dépendances
# ---------------------------------------------------------------------------
def check_dependencies(root):
    pkg = root / 'package.json'
    if not pkg.exists():
        return
    data = json.loads(read(pkg) or '{}')
    deps = {**data.get('dependencies', {}), **data.get('devDependencies', {})}
    next_v = re.sub(r'^[^\d]*', '', deps.get('next', ''))
    if next_v:
        parts = [int(x) for x in re.findall(r'\d+', next_v)[:3]] + [0, 0, 0]
        major, minor, patch = parts[:3]
        vulnerable = (major < 12 or (major == 12 and (minor, patch) < (3, 5)) or (major == 13 and (minor, patch) < (5, 9))
                      or (major == 14 and (minor, patch) < (2, 25)) or (major == 15 and (minor, patch) < (2, 3)))
        if vulnerable:
            add('CRITIQUE', 'Dépendances', f'Next.js {next_v} : contournement du middleware (CVE-2025-29927)', 'package.json',
                'Un en-tête x-middleware-subrequest permet de sauter le middleware : si la connexion n’est vérifiée QUE là, les pages privées sont ouvertes.',
                'Mettre Next.js à jour (≥ 14.2.25 ou ≥ 15.2.3) et revérifier l’utilisateur dans chaque page et route.')
    lock = next((n for n in ('package-lock.json', 'pnpm-lock.yaml', 'yarn.lock') if (root / n).exists()), None)
    if lock != 'package-lock.json':
        if lock is None:
            add('MOYENNE', 'Dépendances', 'Pas de fichier de verrouillage des versions', 'package.json',
                'Sans lockfile, chaque installation peut tirer des versions différentes (et vulnérables).', 'Commiter package-lock.json.')
        return
    if not shutil.which('npm'):
        return
    _, out, _ = run(['npm', 'audit', '--omit=dev', '--json'], root, timeout=180)
    try:
        audit = json.loads(out)
    except json.JSONDecodeError:
        return
    for name, v in (audit.get('vulnerabilities') or {}).items():
        sev = v.get('severity')
        if sev not in ('critical', 'high'):
            continue
        via = [x.get('title') for x in v.get('via', []) if isinstance(x, dict)]
        add('CRITIQUE' if sev == 'critical' else 'HAUTE', 'Dépendances', f'Paquet vulnérable : {name} ({sev})', 'package-lock.json',
            '; '.join(via[:2]) or 'Vulnérabilité connue dans une dépendance.',
            'npm audit fix, ou mise à jour ciblée (overrides si la dépendance est indirecte).')


# ---------------------------------------------------------------------------
# 3. Base de données (Supabase / Postgres)
# ---------------------------------------------------------------------------
def check_database(root):
    sql_files = [p for p in files(root, {'.sql'})]
    if not sql_files:
        return
    created, rls = {}, set()
    for p in sql_files:
        text = read(p)
        for m in re.finditer(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?', text, re.I):
            created.setdefault(m.group(1).lower(), f'{rel(root, p)}:{line_of(text, m.start())}')
        for m in re.finditer(r'alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?(\w+)"?\s+enable\s+row\s+level\s+security', text, re.I):
            rls.add(m.group(1).lower())
        for m in re.finditer(r'create\s+policy[^;]*?for\s+(insert|update|delete|all)[^;]*?(?:using|with\s+check)\s*\(\s*true\s*\)', text, re.I | re.S):
            add('CRITIQUE', 'Base de données', f'Politique RLS ouverte à tous en écriture ({m.group(1).upper()})', f'{rel(root, p)}:{line_of(text, m.start())}',
                '`using (true)` / `with check (true)` en écriture : n’importe quel visiteur peut modifier ou supprimer ces lignes.',
                'Restreindre à `auth.uid() = user_id` (propriétaire) ou `public.is_admin()`.')
        for m in re.finditer(r'create\s+(?:or\s+replace\s+)?function\s+([\w.]+)[^;]*?security\s+definer(?![^$]*?set\s+search_path)', text, re.I | re.S):
            add('MOYENNE', 'Base de données', f'Fonction SECURITY DEFINER sans search_path : {m.group(1)}', f'{rel(root, p)}:{line_of(text, m.start())}',
                'Une fonction qui s’exécute avec les droits de son créateur sans `set search_path` peut être détournée.',
                'Ajouter `set search_path = public` (ou vide) à la fonction.')
        for m in re.finditer(r'grant\s+(?:all|insert|update|delete)[^;]*?\bto\s+anon\b', text, re.I | re.S):
            add('À VÉRIFIER', 'Base de données', 'Droits d’écriture donnés au rôle anonyme', f'{rel(root, p)}:{line_of(text, m.start())}',
                'Le visiteur non connecté a des droits d’écriture : seule la RLS le retient.', 'Vérifier que chaque table concernée a la RLS et des politiques strictes.')
    for table, where in created.items():
        if table not in rls:
            add('CRITIQUE', 'Base de données', f'Table sans sécurité ligne par ligne (RLS) : {table}', where,
                'Avec Supabase, une table sans RLS est lisible et modifiable par n’importe qui avec la clé publique (présente dans le navigateur).',
                f'`alter table public.{table} enable row level security;` + politiques propriétaire/admin.')


# ---------------------------------------------------------------------------
# 4. Code : routes, client, injections, redirections
# ---------------------------------------------------------------------------
AUTH_MARKERS = r'getUser\(|getSession\(|auth\(\)|requireAdmin|requireUser|requireAuth|isAuthorized|currentUser\(|getServerSession|verifyToken|jwtVerify|timingSafeEqual|safeEqual|createHmac|hmac|signature|verifySignature|constructEvent|CRON_SECRET|SETUP_TOKEN|x-api-key|authorization|signOut\('
PUBLIC_ROUTE_HINT = r'/(health|status|og|sitemap|robots|public|auth/callback|auth/confirm)'


def check_code(root):
    code_files = [p for p in files(root, CODE_EXT) if 'node_modules' not in p.parts]
    for p in code_files:
        text = read(p)
        r = rel(root, p)
        is_client = bool(re.match(r'\s*[\'"]use client[\'"]', text))
        is_route = p.name in ('route.ts', 'route.js') or '/pages/api/' in f'/{r}'
        is_action = bool(re.match(r'\s*[\'"]use server[\'"]', text))

        # Clés serveur exposées au navigateur
        for m in re.finditer(r'NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE|PRIVATE|PASSWORD|TOKEN)[A-Z0-9_]*', text):
            add('CRITIQUE', 'Exposition', f'Variable secrète publiée dans le navigateur : {m.group(0)}', f'{r}:{line_of(text, m.start())}',
                'Tout ce qui commence par NEXT_PUBLIC_ est envoyé dans le JavaScript du navigateur.', 'Renommer sans NEXT_PUBLIC_ et ne l’utiliser que côté serveur.')
        if is_client:
            for m in re.finditer(r'process\.env\.(?!NEXT_PUBLIC_|NODE_ENV\b)(\w+)|SERVICE_ROLE|service_role|createAdminClient|serviceClient\(', text):
                add('CRITIQUE', 'Exposition', 'Clé ou client serveur dans un composant navigateur', f'{r}:{line_of(text, m.start())}',
                    'Ce fichier est « use client » : son code part dans le navigateur.', 'Déplacer cet appel dans une route API ou un composant serveur.')
                break

        # Rôle administrateur lu dans des données que l'utilisateur modifie lui-même
        for m in re.finditer(r'user_metadata\??\.(?:role|is_admin|isAdmin|admin|plan)|raw_user_meta_data\s*->>?\s*\'(?:role|is_admin)', text):
            add('CRITIQUE', 'Accès', 'Droits lus dans user_metadata (modifiable par l’utilisateur)', f'{r}:{line_of(text, m.start())}',
                'Avec Supabase, chaque utilisateur peut modifier son propre user_metadata (supabase.auth.updateUser) et se donner le rôle admin.',
                'Lire le rôle dans une table protégée (profiles.is_admin non modifiable par l’utilisateur) ou dans app_metadata.')

        # Routes API et actions serveur sans contrôle d'identité
        if (is_route or is_action) and not re.search(PUBLIC_ROUTE_HINT, '/' + r):
            writes = re.search(r'export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)|export\s+const\s+(POST|PUT|PATCH|DELETE)\b|req\.method\s*===?\s*[\'"](POST|PUT|PATCH|DELETE)', text)
            if is_action:
                writes = writes or re.search(r'export\s+async\s+function', text)
            if writes and not re.search(AUTH_MARKERS, text, re.I):
                # Un utilitaire maison importé (viewer, session, guard…) fait peut-être le contrôle : à vérifier, pas « haute ».
                helper = re.search(r'import[^;\n]*\b\w*(viewer|session|auth|guard|currentUser|requireUser|withUser)\w*\b', text, re.I)
                add('À VÉRIFIER' if helper else 'HAUTE', 'Accès', 'Route ou action serveur sans contrôle d’identité visible', r,
                    'Aucune vérification de session, de rôle ou de signature écrite dans ce fichier' + (f' (un utilitaire importé, « {helper.group(0).split()[-1]} », le fait peut-être)' if helper else '') + ' : à confirmer.',
                    'Vérifier l’utilisateur (getUser()) et ses droits sur la ressource au début du traitement.')
        if is_route and re.search(r'/webhook', '/' + r) and not re.search(r'createHmac|timingSafeEqual|verify|constructEvent|signature|secret', text, re.I):
            add('CRITIQUE', 'Paiement', 'Webhook sans vérification de signature', r,
                'N’importe qui peut appeler cette adresse et faire croire qu’un paiement a réussi.',
                'Vérifier la signature (HMAC en temps constant) ou un secret partagé, puis revérifier le paiement auprès de la passerelle.')
        if is_route and re.search(r'/cron', '/' + r) and not re.search(r'CRON_SECRET|authorization|isAuthorizedCron', text, re.I):
            add('HAUTE', 'Accès', 'Tâche planifiée appelable par tout le monde', r, 'La route de cron ne vérifie aucun secret.', 'Exiger `Authorization: Bearer <CRON_SECRET>` (comparaison en temps constant).')

        # Identité ou prix pris dans ce que le NAVIGATEUR envoie (IDOR, prix modifiable)
        sent = set(re.findall(r'(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:request|req)\.(?:json\(\)|body)', text))
        sent |= {n for group in re.findall(r'(?:const|let)\s*\{([^}]*)\}\s*=\s*(?:await\s+)?(?:request|req)\.(?:json\(\)|body)', text) for n in re.findall(r'\w+', group)}
        sent.add('body')
        names = '|'.join(sorted(sent))
        from_sent = rf'(?:const|let)\s*\{{([^}}]*)\}}\s*=\s*(?:(?:await\s+)?(?:request|req)\.(?:json\(\)|body)|(?:{names})\b)'
        id_pat = rf'\b(?:{names})\s*\??\.\s*(user_?[iI]d|userid|owner_?[iI]d|customer_?[iI]d)\b|searchParams\.get\([\'"](user_?[iI]d|owner_?[iI]d)[\'"]\)'
        destructured_id = next((m2 for m2 in re.finditer(from_sent, text) if re.search(r'\b(user_?[iI]d|owner_?[iI]d)\b', m2.group(1))), None)
        m = re.search(id_pat, text) or destructured_id
        if m and not re.search(r'requireAdmin', text):
            add('HAUTE', 'Accès', 'Identité de l’utilisateur prise dans la requête (IDOR)', f'{r}:{line_of(text, m.start())}',
                'Si l’identifiant vient de ce que le navigateur envoie, un utilisateur peut agir au nom d’un autre en changeant l’identifiant.',
                'Prendre l’identité dans la session (getUser()) et vérifier que la ressource lui appartient.')
        if is_route and not re.search(r'requireAdmin', text) and not re.search(r'/webhook', '/' + r):
            m = re.search(rf'\b(?:{names})\s*\??\.\s*(amount|price|total|montant|prix|credits)\b', text)
            field = m.group(1) if m else None
            if not m:
                for m2 in re.finditer(from_sent, text):
                    hit = re.search(r'\b(amount|price|total|montant|prix|credits)\b', m2.group(1))
                    if hit:
                        m, field = m2, hit.group(1)
                        break
            if m:
                add('HAUTE', 'Paiement', f'Montant envoyé par le navigateur ({field})', f'{r}:{line_of(text, m.start())}',
                    'Un client peut modifier le montant envoyé par son navigateur et payer moins (ou se créditer plus).',
                    'Lire le prix dans le catalogue côté serveur à partir d’un identifiant d’offre.')
        if is_route and re.search(r'/webhook', '/' + r) and re.search(r'\b(?:amount|montant)\b', text) and not re.search(r'expected|order\w*\.(?:amount|price|total)|!==|!=|mismatch|tolerance', text, re.I):
            add('À VÉRIFIER', 'Paiement', 'Montant du webhook peut-être pas comparé à la commande', r,
                'Le montant reçu doit être comparé à celui de la commande enregistrée, sinon un petit paiement peut valider une grosse commande.',
                'Comparer le montant reçu au montant attendu avant de créditer.')

        # Injections, XSS
        for m in re.finditer(r'dangerouslySetInnerHTML', text):
            add('À VÉRIFIER', 'Injection', 'HTML injecté sans échappement (dangerouslySetInnerHTML)', f'{r}:{line_of(text, m.start())}',
                'Si le contenu vient d’un utilisateur, c’est une faille XSS (vol de session).', 'Nettoyer avec sanitize-html / DOMPurify, ou afficher en texte.')
        for m in re.finditer(r'\beval\(|new Function\(|\.innerHTML\s*=', text):
            add('MOYENNE', 'Injection', 'Exécution ou insertion de code dynamique', f'{r}:{line_of(text, m.start())}',
                'eval / new Function / innerHTML avec une donnée externe permettent d’exécuter du code.', 'Supprimer ou remplacer par une solution sans exécution dynamique.')
        for m in re.finditer(r'(?:query|execute|raw|unsafe|\$queryRawUnsafe|\.sql)\(\s*`[^`]*\$\{', text):
            add('HAUTE', 'Injection', 'Requête SQL construite avec une variable', f'{r}:{line_of(text, m.start())}',
                'Une valeur insérée dans le texte d’une requête SQL permet l’injection SQL.', 'Requêtes paramétrées ($1, ?) ou constructeur de requêtes.')
        for m in re.finditer(r'\.(?:or|filter)\(\s*`[^`]*?\$\{\s*([\w.]+)', text):
            var = m.group(1).split('.')[-1]
            from_request = re.search(rf'\b{re.escape(var)}\b\s*=\s*[^\n;]*(searchParams|params|query|body|json\(\)|request|req\.)', text) or m.group(1).split('.')[0] in sent
            validated = re.search(rf'(test|match|isUuid|isValid\w*|valid\w*|parse|safeParse)\(\s*{re.escape(var)}\b|{re.escape(var)}\s*\)\s*\)?\s*(?:return|\{{)|\b{re.escape(var)}\.match\(', text)
            add('HAUTE' if from_request and not validated else 'À VÉRIFIER', 'Injection', 'Filtre Supabase construit avec une variable', f'{r}:{line_of(text, m.start())}',
                'Une valeur insérée dans .or()/.filter() peut ajouter des conditions (injection de filtre PostgREST).', 'Valider la valeur (UUID, liste blanche) ou utiliser .eq().')

        # Redirections ouvertes
        for m in re.finditer(r'redirect\((?:[^)]*?)(?:searchParams\.get\(|query\.)[\'"]?(next|redirect|redirect_to|returnTo|callbackUrl|url)', text):
            add('MOYENNE', 'Redirection', 'Redirection vers une adresse fournie par le visiteur', f'{r}:{line_of(text, m.start())}',
                'Un lien piégé peut renvoyer l’utilisateur vers un faux site après connexion (hameçonnage).', 'N’accepter qu’un chemin interne commençant par « / » (et pas « // »).')
        if re.search(r'headers\.get\([\'"](?:origin|host|x-forwarded-host)[\'"]\)', text) and re.search(r'redirect|callback|return_url|success_url|url', text):
            m = re.search(r'headers\.get\([\'"](?:origin|host|x-forwarded-host)[\'"]\)', text)
            add('À VÉRIFIER', 'Redirection', 'Adresse du site tirée des en-têtes de la requête', f'{r}:{line_of(text, m.start())}',
                'Les en-têtes Origin/Host sont modifiables : une adresse de retour de paiement ou un lien e-mail peut pointer vers un autre site.',
                'Utiliser l’adresse du site fixée côté serveur (NEXT_PUBLIC_SITE_URL).')

        # CORS, cookies, journaux
        if re.search(r'Access-Control-Allow-Origin[\'"]?\s*[,:]\s*[\'"]\*', text) and re.search(r'Allow-Credentials[\'"]?\s*[,:]\s*[\'"]?true', text):
            add('HAUTE', 'Navigateur', 'CORS ouvert à tous avec identifiants', r, 'N’importe quel site peut appeler l’API au nom de l’utilisateur connecté.', 'Lister les origines autorisées.')
        for m in re.finditer(r'httpOnly\s*:\s*false|secure\s*:\s*false', text):
            add('MOYENNE', 'Navigateur', 'Cookie sans protection', f'{r}:{line_of(text, m.start())}', 'Cookie lisible par JavaScript ou envoyé en clair.', 'httpOnly: true, secure: true, sameSite: "lax".')
        for m in re.finditer(r'console\.(?:log|info|error|warn)\([^)]*?(?:,\s*|\$\{\s*)[\w.]*(?:apiKey|api_key|secret|password|token|authorization)\w*\s*[,)}]', text, re.I):
            add('MOYENNE', 'Journaux', 'Secret possiblement écrit dans les journaux', f'{r}:{line_of(text, m.start())}', 'Les journaux sont lus par l’hébergeur et souvent partagés.', 'Ne jamais journaliser une clé, un jeton ou un mot de passe.')

    # En-têtes de sécurité
    cfg = next((root / n for n in ('next.config.ts', 'next.config.js', 'next.config.mjs') if (root / n).exists()), None)
    if cfg:
        text = read(cfg)
        missing = [h for h, pat in [('Content-Security-Policy', r'Content-Security-Policy'), ('Strict-Transport-Security', r'Strict-Transport-Security'),
                                     ('X-Frame-Options / frame-ancestors', r'X-Frame-Options|frame-ancestors'), ('X-Content-Type-Options', r'X-Content-Type-Options')]
                   if not re.search(pat, text)]
        if missing:
            add('MOYENNE', 'Navigateur', 'En-têtes de sécurité absents', rel(root, cfg), 'Manquent : ' + ', '.join(missing) + '.',
                'Les ajouter dans headers() de next.config (HSTS, CSP, frame-ancestors, nosniff).')
        m = re.search(r'bodySizeLimit\s*:\s*[\'"](\d+)\s*mb', text, re.I)
        if m and int(m.group(1)) > 10:
            add('MOYENNE', 'Abus', f'Taille de requête très élevée ({m.group(1)} Mo)', rel(root, cfg), 'Facilite la saturation du serveur.', 'Limiter à ce qui est nécessaire (1 à 5 Mo).')

    # Limitation de débit
    all_code = '\n'.join(read(p) for p in code_files[:3000])
    if code_files and not re.search(r'rate.?limit|ratelimit|Ratelimit|limiter|throttle|upstash', all_code, re.I):
        add('MOYENNE', 'Abus', 'Aucune limitation du nombre de tentatives', '(projet)',
            'Connexion, inscription, mot de passe oublié et paiement peuvent être martelés (force brute, spam, coûts).',
            'Limiter par adresse IP et par compte sur ces routes.')

    # Docker
    df = root / 'Dockerfile'
    if df.exists():
        text = read(df)
        if not re.search(r'^\s*USER\s+(?!root)', text, re.M | re.I):
            add('MOYENNE', 'Serveur', 'Le conteneur tourne en root', 'Dockerfile', 'Une faille dans l’application donne tous les droits dans le conteneur.', 'Ajouter un utilisateur dédié (USER nextjs).')
        for m in re.finditer(r'^\s*(?:ARG|ENV)\s+\w*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|API_KEY)\w*\s*[= ]\s*\S+', text, re.M | re.I):
            add('HAUTE', 'Secrets', 'Secret écrit dans le Dockerfile', f'Dockerfile:{line_of(text, m.start())}', 'Il reste dans l’image, lisible par qui la récupère.', 'Le passer en variable d’exécution chez l’hébergeur.')


# ---------------------------------------------------------------------------
# Rapport
# ---------------------------------------------------------------------------
def report(root):
    counts = {lvl: sum(1 for f in findings if f['niveau'] == lvl) for lvl in ORDER}
    out = [f'# Scan de sécurité automatique : {root.name}', '',
           'Première passe automatique. Chaque point est un SIGNAL à confirmer en lisant le code ; la revue manuelle trouve ce qu’un scanner ne voit pas (logique métier, droits entre clients, paiements).', '',
           '| Niveau | Nombre |', '|---|---|'] + [f'| {lvl} | {counts[lvl]} |' for lvl in ORDER] + ['']
    for lvl in ORDER:
        group = [f for f in findings if f['niveau'] == lvl]
        if not group:
            continue
        out.append(f'## {lvl}')
        for i, f in enumerate(group, 1):
            out += [f"### {i}. {f['titre']}", f"- **Où** : `{f['ou']}`", f"- **Catégorie** : {f['categorie']}", f"- **Risque** : {f['detail']}", f"- **Correction** : {f['correction']}", '']
    return '\n'.join(out), counts


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    root = Path(sys.argv[1]).resolve()
    if not root.is_dir():
        sys.exit(f'Dossier introuvable : {root}')
    check_secrets(root)
    check_dependencies(root)
    check_database(root)
    check_code(root)
    text, counts = report(root)
    if '--sortie' in sys.argv:
        dest = Path(sys.argv[sys.argv.index('--sortie') + 1])
        dest.write_text(text, encoding='utf-8')
        print(f'Rapport écrit : {dest}')
    else:
        print(text)
    print(' · '.join(f'{k} : {v}' for k, v in counts.items()), file=sys.stderr)


if __name__ == '__main__':
    main()
