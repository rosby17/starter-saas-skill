#!/usr/bin/env python3
"""Scanner de robustesse d'un SaaS (première passe automatique, rubrique « robustesse » du mode audit).

Usage : python3 audit_robustesse.py <dossier-du-projet> [--sortie rapport.md]

Il ne modifie RIEN et n'exécute aucun code du projet.
Il cherche ce qui fait tomber ou ralentir un SaaS quand il grandit ou qu'un service extérieur flanche :
appels sans délai maximal, erreurs de la base ignorées, listes sans limite, index manquants, pages d'erreur,
contrôle de santé, journal d'erreurs, tâches planifiées qui se chevauchent, build qui cache les erreurs, sauvegardes.
Niveaux : CRITIQUE (panne ou perte de données probable), HAUTE, MOYENNE, À VÉRIFIER.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_securite as base  # noqa: E402

findings = []


def add(level, category, title, where, detail, fix):
    findings.append({'niveau': level, 'categorie': category, 'titre': title, 'ou': where, 'detail': detail, 'correction': fix})


def server_side(text, r):
    """Code qui tourne sur le serveur de l'application (pas un script local, pas un composant navigateur)."""
    return (re.match(r'(src|app|lib|pages|server)/', r) is not None and not re.match(r'\s*[\'"]use client[\'"]', text)
            and not re.search(r'(^|/)(components|hooks)/', r))


def grouped(level, category, title, r, lines, detail, fix):
    """Un seul signal par fichier, avec toutes les lignes concernées."""
    if lines:
        where = f'{r}:{lines[0]}' + (f' (+ lignes {", ".join(map(str, lines[1:8]))}{"…" if len(lines) > 8 else ""})' if len(lines) > 1 else '')
        add(level, category, title + (f' ({len(lines)} endroits)' if len(lines) > 1 else ''), where, detail, fix)


def check_external_calls(root, code):
    """fetch vers l'extérieur sans délai maximal : une passerelle lente bloque la requête du client jusqu'à l'abandon."""
    for p, t in code.items():
        r = base.rel(root, p)
        if not server_side(t, r):
            continue
        lines = []
        for m in re.finditer(r'\bfetch\(\s*([`\'"]https?://|[\w.]+(?:Url|URL|_URL|url|endpoint|Endpoint)\b|`\$\{)', t):
            call = t[m.start() + len('fetch'):m.start() + 900]
            # Fin approximative de l'appel : la parenthèse fermante qui équilibre fetch(
            depth, end = 0, len(call)
            for i, ch in enumerate(call):
                depth += ch == '('
                depth -= ch == ')'
                if depth == 0 and i > 0:
                    end = i
                    break
            if not re.search(r'signal\b|timeout', call[:end + 1]) and not re.search(r'withTimeout|fetchWithTimeout', t):
                lines.append(base.line_of(t, m.start()))
        grouped('MOYENNE', 'Services extérieurs', 'Appel extérieur sans délai maximal', r, lines,
                'Si ce service répond lentement ou plus du tout, la requête du client reste bloquée (paiement, e-mail, IA) et occupe le serveur.',
                'Ajouter `signal: AbortSignal.timeout(15_000)` (ou adapté) et gérer l’échec proprement.')


def check_db_errors(root, code):
    """Écriture en base dont l'échec n'est jamais regardé."""
    for p, t in code.items():
        r = base.rel(root, p)
        lines, kinds = [], set()
        for m in re.finditer(r'await\s+[\w.()\[\]\'" ]*?\.from\(\s*[\'"`][\w.]+[\'"`]\s*\)\s*\.(insert|update|upsert|delete)\(', t):
            if re.search(r'^\s*(?://|\*)', t[t.rfind('\n', 0, m.start()) + 1:m.start()]):
                continue
            before = t[max(0, m.start() - 120):m.start()]
            stmt_end = t.find(';', m.end())
            stmt_end = len(t) if stmt_end < 0 else stmt_end
            statement = t[m.start():min(stmt_end, m.start() + 800)]
            # Bien : `const { error } = await …`, `.throwOnError()`, ou un résultat gardé dans une variable puis contrôlé.
            assigned = re.search(r'(?:const|let|var)\s*(?:\{[^}]*\}|\w+)\s*=\s*$|=\s*$|return\s+$', before)
            if assigned or 'throwOnError' in statement:
                continue
            lines.append(base.line_of(t, m.start()))
            kinds.add(m.group(1))
        grouped('MOYENNE', 'Base de données', f'Écriture en base sans contrôle d’erreur ({", ".join(sorted(kinds))})', r, lines,
                'Si l’écriture échoue (droits, contrainte, coupure), personne ne le sait : le client croit que c’est enregistré, les données sont incohérentes.',
                'Récupérer `{ error }` et le traiter (message au client, journal), ou ajouter `.throwOnError()`.')


def check_unbounded_lists(root, code):
    """Listes chargées en entier : rapide avec 50 lignes, en panne avec 50 000."""
    for p, t in code.items():
        r = base.rel(root, p)
        if not server_side(t, r):
            continue
        hits = []
        for m in re.finditer(r'\.from\(\s*[\'"`]([\w.]+)[\'"`]\s*\)\s*\.select\(', t):
            stmt_end = t.find(';', m.end())
            chain = t[m.end():(stmt_end if stmt_end > 0 else len(t))][:600]
            nxt = re.search(r'\n\s*\n|\bconst\b|\blet\b|\breturn\b', chain)
            chain = chain[:nxt.start()] if nxt else chain
            if re.search(r'\.(?:limit|range|single|maybeSingle)\(|head:\s*true|\.eq\(\s*[\'"](?:id|user_id|owner_id)[\'"]|\.in\(', chain):
                continue
            # Petites tables de réglages (clé → valeur) : elles ne grandissent pas avec le nombre de clients.
            if re.search(r'settings|secrets|config|rates|flags|locks|plans', m.group(1), re.I):
                continue
            hits.append((m.group(1), base.line_of(t, m.start())))
        if hits:
            tables = ', '.join(sorted({h[0] for h in hits}))
            add('À VÉRIFIER', 'Montée en charge', f'Liste chargée sans limite ({tables})', f'{r}:{hits[0][1]}',
                'Toutes les lignes sont chargées d’un coup. Sur une table qui grandit (commandes, messages, journaux), la page devient lente puis tombe.',
                'Paginer (`.range(début, fin)`) ou limiter (`.limit(50)`), et filtrer côté base plutôt qu’en JavaScript.')
        for m in re.finditer(r'for\s*\([^)]*\)\s*\{[^{}]{0,400}?await\s+[\w.]*\.from\(|\.forEach\(\s*async|\.map\(\s*async[^)]*\)\s*=>\s*\{?[^{}]{0,200}?\.from\(', t):
            add('À VÉRIFIER', 'Montée en charge', 'Une requête à la base par élément d’une boucle', f'{r}:{base.line_of(t, m.start())}',
                'Une requête par élément : 1 000 éléments = 1 000 allers-retours vers la base. Lent, et `forEach(async…)` n’attend même pas la fin.',
                'Une seule requête groupée (`.in("id", ids)`, `upsert` d’un tableau) ou `Promise.all` par paquets.')


def check_database_schema(root):
    sql = [(p, base.read(p)) for p in base.files(root, {'.sql'})]
    if not sql:
        return
    all_sql = '\n'.join(t for _, t in sql)
    indexed = set()
    for m in re.finditer(r'create\s+(?:unique\s+)?index[^;]*?\bon\s+(?:public\.)?"?(\w+)"?\s*(?:using\s+\w+\s*)?\(\s*"?(\w+)"?', all_sql, re.I):
        indexed.add((m.group(1).lower(), m.group(2).lower()))
    for p, t in sql:
        r = base.rel(root, p)
        for tm in re.finditer(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*\((.*?)\n\);', t, re.I | re.S):
            table, body = tm.group(1).lower(), tm.group(2)
            for pk in re.finditer(r'(?:primary\s+key|unique)\s*\(\s*"?(\w+)"?', body, re.I):
                indexed.add((table, pk.group(1).lower()))
            for cm in re.finditer(r'^\s*"?(\w+)"?\s+[\w ]+?\breferences\b', body, re.I | re.M):
                col = cm.group(1).lower()
                line_end = body.find('\n', cm.start(1))
                if re.search(r'primary\s+key', body[cm.start(1):line_end if line_end > 0 else len(body)], re.I) or (table, col) in indexed:
                    continue
                indexed.add((table, col))  # signalé une seule fois, même si plusieurs scripts recréent la table
                add('MOYENNE', 'Montée en charge', f'Clé étrangère sans index : {table}.{col}', f'{r}:{base.line_of(t, tm.start(2) + cm.start(1))}',
                    'Chaque recherche « les lignes de ce client » parcourt toute la table : invisible au début, très lent avec des milliers de lignes (et la RLS filtre souvent sur cette colonne).',
                    f'`create index if not exists {table}_{col}_idx on public.{table}({col});` dans une migration neuve.')
    # Numéros de migration (0001_…, 20240101120000_…) ; les noms datés au jour près (2026-09-28-…) ne sont pas ordonnés par numéro.
    prefixes = [m.group(1) for p, _ in sql for m in [re.match(r'(\d+)_', p.name)] if m]
    dupes = sorted({x for x in prefixes if prefixes.count(x) > 1})
    if dupes:
        add('MOYENNE', 'Base de données', 'Migrations avec le même numéro', ', '.join(dupes),
            'Deux migrations au même numéro peuvent s’appliquer dans un ordre différent d’une machine à l’autre.', 'Renuméroter la plus récente.')
    for p, t in sql:
        for m in re.finditer(r'\b(drop\s+table|drop\s+column|truncate)\b(?![^;]*if\s+exists)', t, re.I):
            add('À VÉRIFIER', 'Base de données', f'Migration destructive ({m.group(1).lower()})', f'{base.rel(root, p)}:{base.line_of(t, m.start())}',
                'Cette migration efface des données. Rejouée sur la base en ligne, la perte est définitive.', 'Vérifier qu’une sauvegarde est faite avant, et que la donnée n’est plus utilisée.')


def check_app_shell(root, code, paths):
    app = next((d for d in ('src/app', 'app') if (root / d).is_dir()), None)
    pkg = base.read(root / 'package.json')
    if app and '"next"' in pkg:
        if not (root / app / 'error.tsx').exists() and not (root / app / 'error.jsx').exists():
            add('MOYENNE', 'Erreurs', 'Pas de page d’erreur', f'{app}/error.tsx',
                'Une erreur imprévue affiche un écran blanc ou technique : le client pense que le site est cassé et part.', 'Ajouter error.tsx (message clair + bouton « Réessayer »).')
        if not (root / app / 'global-error.tsx').exists() and not (root / app / 'global-error.jsx').exists():
            add('MOYENNE', 'Erreurs', 'Pas de page d’erreur globale', f'{app}/global-error.tsx',
                'Une erreur dans la mise en page principale contourne error.tsx et affiche la page brute de Next.js.', 'Ajouter global-error.tsx (avec ses propres balises html et body).')
    all_code = '\n'.join(code.values())
    projet = base.texte_projet(root)
    if code and not any(re.search(r'(^|/)(health|healthz|status|ping)(/|\.)', x) for x in paths) and not re.search(r'[\'"/](?:api/)?(?:health|healthz|sante|ping)[\'"/\s?]', projet, re.I):
        add('MOYENNE', 'Surveillance', 'Aucune adresse de contrôle de santé', '(projet)',
            'L’hébergeur et les outils de surveillance ne peuvent pas savoir si l’application répond ; une panne passe inaperçue.', 'Une route /api/health qui renvoie 200.')
    df = root / 'Dockerfile'
    if df.exists() and not re.search(r'^\s*HEALTHCHECK\b', base.read(df), re.M | re.I):
        add('MOYENNE', 'Surveillance', 'Le conteneur n’a pas de contrôle de santé', 'Dockerfile',
            'Sans HEALTHCHECK, l’hébergeur (Coolify, Docker) considère l’application prête même si elle a planté au démarrage, et une mise à jour cassée remplace la version qui marchait.',
            'Ajouter `HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1`.')
    if code and not re.search(r'sentry|onRequestError|bugsnag|rollbar|logtail|betterstack|axiom|highlight\.io|glitchtip|reportError|captureException|rapports?\.noter|rapport_erreur|error_logs?|journal\.noter', all_code + '\n' + projet, re.I):
        add('MOYENNE', 'Surveillance', 'Les erreurs des clients ne sont remontées nulle part', '(projet)',
            'Quand une page plante chez un client, personne n’est prévenu : on l’apprend (parfois) par un client mécontent.',
            'Brancher un suivi des erreurs (GlitchTip ou Sentry auto-hébergeable) ou au minimum `onRequestError` dans instrumentation.ts qui écrit dans un journal consulté.')
    if base.pile(root) == 'next' and code and not re.search(r'process\.env\[[^\]]+\]\s*\)|REQUIRED_\w*ENV|assert\w*Env|z\.object\([^)]*process\.env|createEnv\(|envSchema', all_code):
        add('MOYENNE', 'Configuration', 'Variables d’environnement non vérifiées au démarrage', '(projet)',
            'Une clé oubliée ne se voit qu’au premier client qui tombe dessus (paiement, connexion), avec une erreur incompréhensible.',
            'Vérifier au démarrage la présence des variables indispensables et refuser de démarrer sinon.')


def check_build(root):
    cfg = next((root / n for n in ('next.config.ts', 'next.config.js', 'next.config.mjs') if (root / n).exists()), None)
    if cfg:
        t = base.read(cfg)
        for m in re.finditer(r'ignoreBuildErrors\s*:\s*true|ignoreDuringBuilds\s*:\s*true', t):
            add('HAUTE', 'Qualité', 'Le build ignore les erreurs', f'{base.rel(root, cfg)}:{base.line_of(t, m.start())}',
                'Du code qui ne compile pas (ou que le contrôle refuse) part quand même en ligne : les pannes se découvrent chez les clients.',
                'Retirer cette option et corriger les erreurs qu’elle cachait.')
    ts = base.read(root / 'tsconfig.json')
    if ts and re.search(r'"strict"\s*:\s*false', ts):
        add('MOYENNE', 'Qualité', 'TypeScript en mode non strict', 'tsconfig.json',
            'Les valeurs manquantes (null, undefined) ne sont pas vérifiées : c’est la première cause de « Cannot read properties of undefined » en production.',
            'Passer "strict": true et corriger progressivement.')
    paths = [base.rel(root, p) for p in base.files(root)]
    if not any(re.search(r'(\.|/)(test|spec)\.[jt]sx?$|(^|/)(tests?|__tests__|e2e)/', x) for x in paths):
        add('À VÉRIFIER', 'Qualité', 'Aucun test automatique', '(projet)',
            'Chaque modification peut casser le paiement ou la connexion sans que personne ne s’en rende compte avant un client.',
            'Au minimum : un test du parcours inscription → paiement → crédit, et du calcul des droits.')
    if not (root / '.github' / 'workflows').is_dir() and not (root / '.gitlab-ci.yml').exists():
        add('À VÉRIFIER', 'Qualité', 'Aucune vérification automatique à chaque envoi de code', '(projet)',
            'Rien ne vérifie que le code compile avant la mise en ligne.', 'Une action GitHub : installation, lint, contrôle des types, build, à chaque push.')
    pkg = base.read(root / 'package.json')
    if pkg and re.search(r'"(?:next|react|@supabase/supabase-js)"\s*:\s*"(?:latest|\*)"', pkg):
        add('MOYENNE', 'Qualité', 'Dépendance principale en version « latest »', 'package.json',
            'Chaque installation peut tirer une nouvelle version majeure qui casse l’application.', 'Fixer une plage de version (^15.5.0).')


def check_jobs(root, code):
    for p, t in code.items():
        r = base.rel(root, p)
        if not re.search(r'/cron/', '/' + r) or p.name not in ('route.ts', 'route.js'):
            continue
        if not re.search(r'lock|verrou|advisory|for update skip locked|running', t, re.I):
            add('À VÉRIFIER', 'Tâches planifiées', 'Tâche planifiée sans verrou', r,
                'Si une exécution dure plus longtemps que l’intervalle (ou si l’appel est relancé), deux exécutions tournent en même temps : doubles e-mails, doubles crédits.',
                'Prendre un verrou au début (table de verrous, pg_try_advisory_lock) et le relâcher à la fin.')


def check_backups(root, code):
    everything = '\n'.join(code.values()) + '\n'.join(base.read(p) for p in base.files(root, {'.md', '.yml', '.yaml', '.sh', '.toml'}))
    if not re.search(r'backup|sauvegarde|pg_dump|pgbackrest|wal-g|point.in.time|PITR', everything, re.I):
        add('À VÉRIFIER', 'Données', 'Aucune sauvegarde de la base visible', '(projet)',
            'Rien dans le projet ne parle de sauvegarde. Si la base est perdue (erreur, serveur détruit, migration ratée), tous les comptes, paiements et données des clients disparaissent.',
            'Sauvegarde automatique quotidienne hors du serveur (Coolify : Backups du service base vers un stockage S3), et un essai de restauration.')


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    root = Path(sys.argv[1]).resolve()
    if not root.is_dir():
        sys.exit(f'Dossier introuvable : {root}')
    scan(root)
    base.write_report(*base.report(root, findings, 'Scan de robustesse automatique',
                                   'Première passe automatique : ce qui fait tomber ou ralentir le SaaS quand il grandit ou qu’un service extérieur flanche. Chaque point est un SIGNAL à confirmer en lisant le code.'))


def scan(root):
    """Lance toutes les vérifications et renvoie la liste des signaux (utilisé aussi par audit_complet.py)."""
    code = {p: base.read(p) for p in base.files(root, base.CODE_EXT)}
    paths = [base.rel(root, p) for p in base.files(root)]
    check_external_calls(root, code)
    check_db_errors(root, code)
    check_unbounded_lists(root, code)
    check_database_schema(root)
    check_app_shell(root, code, paths)
    check_build(root)
    check_jobs(root, code)
    check_backups(root, code)
    return findings


if __name__ == '__main__':
    main()
