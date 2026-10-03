#!/usr/bin/env python3
"""Scanner de rentabilité d'un SaaS (première passe automatique, rubrique « rentabilité » du mode audit).

Usage : python3 audit_rentabilite.py <dossier-du-projet> [--sortie rapport.md]

Il ne modifie RIEN et n'exécute aucun code du projet.
Il cherche dans le code ce qui fait perdre de l'argent : fonctions payantes (IA, SMS…) sans limite par client,
crédits dépensables deux fois, prix provisoires, offre gratuite trop généreuse, paiements perdus, absence de mesure.
Les chiffres (marge, point mort) se calculent ensuite avec calcul_rentabilite.py et les vrais coûts du propriétaire.
Niveaux : CRITIQUE (on perd de l'argent tout de suite), HAUTE, MOYENNE, À VÉRIFIER.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_securite as base  # noqa: E402  (mêmes outils : fichiers suivis par Git, lecture, rapport)

findings = []


def add(level, category, title, where, detail, fix):
    findings.append({'niveau': level, 'categorie': category, 'titre': title, 'ou': where, 'detail': detail, 'correction': fix})


# Appels qui coûtent de l'argent à CHAQUE utilisation.
PAID_SDK = (r'\.chat\.completions\.create\(|\.responses\.create\(|\.messages\.(?:create|stream)\(|\b(?:generateText|streamText|generateObject|streamObject)\('
            r'|\.images\.(?:generate|edit)\(|\.audio\.(?:speech|transcriptions)\.create\(|\.embeddings\.create\(|\.generateContent(?:Stream)?\('
            r'|replicate\.run\(|fal\.(?:subscribe|run)\(|textToSpeech\.convert\(')
PAID_HOSTS = (r'api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.mistral\.ai|api\.groq\.com|api\.replicate\.com'
              r'|api\.elevenlabs\.io|api\.deepgram\.com|openrouter\.ai|api\.together\.xyz|api\.stability\.ai|fal\.run|api\.deepseek\.com'
              r'|api\.perplexity\.ai|api\.twilio\.com|api\.cohere\.ai|api\.assemblyai\.com|api\.kie\.ai'
              # Revendeurs et passerelles : on reconnaît la forme de l'adresse plutôt que le nom du fournisseur.
              r'|https?://[^\'"`\s]*/(?:v\d+(?:beta)?/)?(?:chat/completions|messages|responses|images/generations|audio/(?:speech|transcriptions)|embeddings)\b'
              r'|:generateContent\b')
LLM_TEXT = r'https?://(?!graph\.facebook\.com)[^\'"`\s]*/(?:v\d+/)?(?:chat/completions|messages|responses)\b|\.chat\.completions\.create\(|\.responses\.create\(|\.messages\.(?:create|stream)\(|\b(?:generateText|streamText|generateObject|streamObject)\(|\.generateContent(?:Stream)?\('
MAX_LEN = r'max_tokens|maxTokens|max_output_tokens|maxOutputTokens|max_completion_tokens|maxOutputTokens'
# Ce qui montre qu'un usage est décompté ou plafonné (dans la route, ou dans la fonction qu'elle appelle avant l'appel payant).
METERING = (r'debit|deduct|consume|quota|credits?\b|remaining|balance|decrement|dailyLimit|monthlyLimit|maxPer|entitle|allowance'
            r'|count:\s*[\'"]exact[\'"]|>=\s*[\w.]*(?:LIMIT|MAX|QUOTA|MONTHLY|DAILY)\w*'
            # Fonction réservée aux offres payantes : seul un client qui paie déclenche le coût.
            r'|hasTier|hasPlan|isPremium|isPro\b|subscription|\.tier\b')
GUARD_NAME = r'^(?:authorize|check|assert|require|guard|ensure|can|verify|limit)\w*'
EXPENSIVE_MODEL = r'[\'"](claude-opus[\w.-]*|claude-[\d-]+-opus[\w.-]*|gpt-4(?:\.\d+)?(?:-turbo)?|gpt-4o|gpt-5(?:\.\d+)?|o1|o1-pro|o3|o3-pro|gemini-[\d.]+-pro[\w.-]*)[\'"]'
CHUNK = re.compile(r'^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)|^(?:export\s+)?(?:const|let)\s+(\w+)\s*(?::[^=\n]+)?=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*(?::[^=\n]+)?=>|^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?function', re.M)


def is_comment(text, index):
    start = text.rfind('\n', 0, index) + 1
    return bool(re.match(r'\s*(?://|\*|/\*)', text[start:index + 1]))


def code_search(pattern, text):
    """Premier résultat qui n'est pas dans un commentaire."""
    return next((m for m in re.finditer(pattern, text) if not is_comment(text, m.start())), None)


def resolve_import(root, src, spec):
    """Chemin (sans extension) d'un import local, ou None pour un paquet npm."""
    if spec.startswith('@/'):
        target = root / 'src' / spec[2:]
    elif spec.startswith('.'):
        target = (src.parent / spec).resolve()
    else:
        return None
    return str(target.with_suffix('')) if target.suffix in base.CODE_EXT else str(target)


def stem(p):
    s = str(p.with_suffix(''))
    return s[:-len('/index')] if s.endswith('/index') else s


def chunks(text):
    """Découpe un fichier en fonctions de premier niveau : {nom: texte}. Le reste du fichier va sous « (module) »."""
    marks = [(m.start(), next(g for g in m.groups() if g)) for m in CHUNK.finditer(text)]
    out = {'(module)': text[:marks[0][0]] if marks else text}
    for (pos, name), nxt in zip(marks, marks[1:] + [(len(text), None)]):
        out[name] = text[pos:nxt[0]]
    return out


def imported_names(root, p, text):
    """{nom local: (module, nom d'origine)} pour les imports locaux nommés."""
    names = {}
    for group, spec in re.findall(r'import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*[\'"]([^\'"]+)[\'"]', text):
        mod = resolve_import(root, p, spec)
        if not mod:
            continue
        for item in group.split(','):
            parts = item.replace('type ', '').split(' as ')
            if parts[0].strip():
                names[parts[-1].strip()] = (mod, parts[0].strip())
    for local, spec in re.findall(r'import\s+(\w+)\s*(?:,\s*\{[^}]*\})?\s*from\s*[\'"]([^\'"]+)[\'"]', text):
        mod = resolve_import(root, p, spec)
        if mod:
            names[local] = (mod, 'default')
    return names


def check_paid_features(root):
    code = {p: base.read(p) for p in base.files(root, base.CODE_EXT)}
    by_stem = {stem(p): p for p in code}
    parts = {p: chunks(t) for p, t in code.items()}
    imports = {p: imported_names(root, p, t) for p, t in code.items()}

    # Fonctions payantes : celles qui contiennent l'appel facturé, puis (de proche en proche) celles qui les appellent.
    costly = {(p, n) for p in code for n, body in parts[p].items() if code_search(PAID_SDK, body) or code_search(PAID_HOSTS, body)}
    for _ in range(6):
        added = set()
        for p in code:
            local_costly = {n for (q, n) in costly if q == p}
            for n, body in parts[p].items():
                if (p, n) in costly:
                    continue
                calls = set(re.findall(r'\b(\w+)\s*\(', body))
                via_local = calls & local_costly
                via_import = any(by_stem.get(imports[p][c][0]) and ((by_stem[imports[p][c][0]], imports[p][c][1]) in costly)
                                 for c in calls if c in imports[p])
                if via_local or via_import:
                    added.add((p, n))
        if not added:
            break
        costly |= added

    for p in sorted({p for p, _ in costly}):
        t, r = code[p], base.rel(root, p)
        for m in re.finditer(LLM_TEXT, t):
            if is_comment(t, m.start()):
                continue
            if not re.search(MAX_LEN, t[m.start():m.start() + 1500]):
                add('MOYENNE', 'Coûts', 'Réponse d’IA sans longueur maximale', f'{r}:{base.line_of(t, m.start())}',
                    'Sans plafond de longueur, une seule demande peut produire une réponse très longue, donc très chère.',
                    'Fixer max_tokens (ou max_output_tokens / maxOutputTokens) à ce que l’écran affiche vraiment.')
        for m in re.finditer(EXPENSIVE_MODEL, t):
            if not is_comment(t, m.start()):
                add('À VÉRIFIER', 'Coûts', f'Modèle d’IA haut de gamme : {m.group(1)}', f'{r}:{base.line_of(t, m.start())}',
                    'Les modèles haut de gamme coûtent souvent 5 à 20 fois plus cher que leur version légère.',
                    'Essayer la version légère sur 20 vrais exemples ; ne garder le haut de gamme que là où la différence se voit.')

    # Points d'entrée (routes, actions serveur) qui déclenchent un appel payant : qui peut les appeler, et combien de fois ?
    for p in sorted({p for p, _ in costly}):
        t, r = code[p], base.rel(root, p)
        is_route = p.name in ('route.ts', 'route.js') or '/pages/api/' in f'/{r}'
        is_action = bool(re.match(r'\s*[\'"]use server[\'"]', t))
        # Réservé à l'administrateur ou à une tâche planifiée protégée : un client ne peut pas le déclencher.
        if not (is_route or is_action) or re.search(r'(^|/)(admin|cron)/', r):
            continue
        entry = {n: body for n, body in parts[p].items() if (p, n) in costly and n != '(module)'}

        def reach(q, body, depth):
            """Le corps de la fonction + celui des fonctions non payantes qu'elle appelle (contrôles, quotas)."""
            text = [body]
            if depth == 0:
                return text
            for c in set(re.findall(r'\b(\w+)\s*\(', body)):
                if c in parts[q] and c != '(module)' and (q, c) not in costly:
                    text += reach(q, parts[q][c], depth - 1)
                elif c in imports[q]:
                    mod = by_stem.get(imports[q][c][0])
                    orig = imports[q][c][1]
                    if mod and orig in parts[mod] and (mod, orig) not in costly:
                        text += reach(mod, parts[mod][orig], depth - 1)
            return text

        for n, body in entry.items():
            seen = '\n'.join(reach(p, body, 2))
            if code_search(METERING, seen) or re.search(r'requireAdmin|isAdmin\(|assertAdmin|CRON_SECRET', body):
                continue
            calls = set(re.findall(r'\b(\w+)\s*\(', body))
            guard = next((c for c in calls if (c in imports[p] or c in parts[p]) and re.match(GUARD_NAME, c, re.I)), None)
            rate_limited = re.search(r'rate.?limit|ratelimit|limiter|throttle|allow\w*\(|MAX_PER', seen, re.I)
            open_to_all = not re.search(base.AUTH_MARKERS, seen, re.I)
            level = 'CRITIQUE' if open_to_all and not rate_limited else ('À VÉRIFIER' if guard or rate_limited else 'HAUTE')
            note = (f' La fonction « {guard} » appelée avant fait peut-être le contrôle : à lire.' if guard else '') + \
                   (' Une limitation de débit existe : elle ralentit, elle ne plafonne pas le total.' if rate_limited else '')
            add(level, 'Coûts', 'Fonction payante ouverte à tous' if open_to_all else 'Fonction payante sans limite par client', f'{r} ({n})',
                ('N’importe quel visiteur, sans compte, peut déclencher un appel facturé (IA, SMS, WhatsApp…) autant de fois qu’il veut : la facture peut exploser en une nuit.'
                 if open_to_all else
                 'Chaque appel est facturé au propriétaire, mais rien de visible ne décompte de crédits ni ne plafonne l’usage du client : un seul client peut coûter plus que ce qu’il paie.') + note,
                'Exiger un compte, puis débiter des crédits (ou un quota par jour et par offre) AVANT l’appel, de façon atomique.')


def check_credits(root):
    for p in base.files(root, base.CODE_EXT):
        t = base.read(p)
        reads = re.search(r'getCreditsBalance\(|\.select\([\'"][^\'"]*\b(?:credits|balance|solde)\b', t)
        writes = re.search(r'amount\s*:\s*-\s*\w|\.update\(\s*\{[^}]*\b(?:credits|balance|solde)\s*:\s*[\w.]+\s*-\s*\w', t)
        if reads and writes and reads.start() < writes.start():
            add('HAUTE', 'Crédits', 'Crédits débités en deux temps (lecture puis écriture)', f'{base.rel(root, p)}:{base.line_of(t, writes.start())}',
                'Le solde est lu, puis le débit est écrit séparément : deux demandes envoyées en même temps passent toutes les deux le contrôle. Un client consomme deux fois ses crédits (solde négatif, usage gratuit).',
                'Débiter dans UNE fonction SQL qui verrouille le solde du client (pg_advisory_xact_lock ou select … for update), vérifie et écrit dans la même transaction.')


PRICE_KEYS = r'amountLocal|priceMonthly|monthlyPrice|price|prix|amount|montant'


def parse_plans(text):
    plans = []
    for m in re.finditer(r'\{[^{}]*\}', text, re.S):
        block = m.group(0)
        name = re.search(r'\b(?:id|name|nom)\s*:\s*[\'"]([^\'"]+)[\'"]', block)
        price = re.search(rf'\b(?:{PRICE_KEYS})\s*:\s*([\d_]+(?:\.\d+)?)', block)
        if not (name and price):
            continue
        credits = re.search(r'\b(?:credits|crédits|quota|tokens|units|minutes|messages)\s*:\s*([\d_]+)', block)
        plans.append({'nom': name.group(1), 'prix': float(price.group(1).replace('_', '')),
                      'credits': int(credits.group(1).replace('_', '')) if credits else None,
                      'ligne': base.line_of(text, m.start())})
    return plans


def check_pricing(root):
    plans_found = []
    for p in base.files(root, base.CODE_EXT):
        r = base.rel(root, p)
        if not re.search(r'(pricing|plans?|tarifs?|offres?|billing-plans)\.(ts|tsx|js|mjs)$', p.name, re.I):
            continue
        t = base.read(p)
        plans = parse_plans(t)
        if not plans:
            continue
        plans_found.append((r, plans))
        m = re.search(r'TODO|placeholder|replace (?:this|every)|à remplacer|factice|fake', t, re.I)
        if m:
            add('HAUTE', 'Prix', 'Prix provisoires encore en place', f'{r}:{base.line_of(t, m.start())}',
                'Le fichier des offres signale lui-même des prix à remplacer : les prix affichés n’ont pas été calculés à partir des coûts.',
                'Fixer chaque prix avec calcul_rentabilite.py (coûts réels + marge visée), puis retirer les marques TODO.')
        paid = sorted([x for x in plans if x['prix'] > 0 and x['credits']], key=lambda x: x['prix'])
        free = [x for x in plans if x['prix'] == 0 and x['credits']]
        for a, b in zip(paid, paid[1:]):
            if b['prix'] / b['credits'] > a['prix'] / a['credits'] * 1.001:
                add('MOYENNE', 'Prix', f'L’offre « {b["nom"]} » coûte plus cher à l’unité que « {a["nom"]} »', f'{r}:{b["ligne"]}',
                    f'{b["nom"]} : {b["prix"] / b["credits"]:.4g} par unité, contre {a["prix"] / a["credits"]:.4g} pour {a["nom"]}. Un client malin achète plusieurs fois la petite offre ; la grande ne se vend pas.',
                    'Rendre l’unité moins chère (ou égale) dans les grandes offres.')
        if paid and free and free[0]['credits'] >= 0.25 * paid[0]['credits']:
            add('À VÉRIFIER', 'Prix', 'Offre gratuite proche de la première offre payante', f'{r}:{free[0]["ligne"]}',
                f'Gratuit : {free[0]["credits"]} unités, contre {paid[0]["credits"]} pour « {paid[0]["nom"]} » ({paid[0]["prix"]:g}). Si le gratuit suffit à la plupart des clients, presque personne ne paie, et chaque gratuit a un coût.',
                'Garder le gratuit assez petit pour essayer, pas pour s’en contenter (souvent 5 à 15 % de la première offre).')
    return plans_found


def check_revenue_leaks(root, has_free_credits):
    paths = [base.rel(root, p) for p in base.files(root)]
    code = {p: base.read(p) for p in base.files(root, base.CODE_EXT | {'.sql', '.toml', '.yml', '.yaml'})}
    everything = '\n'.join(code.values())
    has_payments = any(re.search(r'/(checkout|webhooks?|payment|paiement|billing)/', '/' + x) for x in paths)
    if has_payments and not any(re.search(r'reconcile|reverify|verify|rattrap|pending', x, re.I) for x in paths):
        add('MOYENNE', 'Paiements', 'Aucun rattrapage des paiements en attente', '(projet)',
            'Si un webhook se perd (coupure, passerelle en retard), le client a payé mais n’est pas servi : il réclame un remboursement ou part.',
            'Une tâche planifiée qui revérifie auprès de la passerelle les commandes « en attente » depuis plus de 10 minutes.')
    if not re.search(r'plausible|umami|posthog|gtag\(|googletagmanager|@vercel/analytics|matomo|mixpanel|amplitude|segment\.com|analytics', everything, re.I):
        add('MOYENNE', 'Mesure', 'Aucune mesure du parcours des visiteurs', '(projet)',
            'Sans mesure, impossible de savoir combien de visiteurs s’inscrivent, combien paient, et à quelle étape ils abandonnent.',
            'Ajouter une mesure d’audience respectueuse (Umami ou Plausible, auto-hébergeable) et suivre : visite → inscription → paiement.')
    sends_email = re.search(r'brevo|sendinblue|resend|sendgrid|nodemailer|postmark|mailgun|smtp|ses\.send', everything, re.I)
    if not sends_email:
        add('MOYENNE', 'Relances', 'Aucun e-mail envoyé par l’application', '(projet)',
            'Pas de reçu, pas de bienvenue, pas de relance : les clients qui n’ont pas fini de payer ou qui ne reviennent pas sont perdus sans un mot.',
            'Brancher un envoi d’e-mails (Brevo, SMTP) : reçu de paiement, bienvenue, relance du paiement non terminé.')
    elif has_payments and not re.search(r'relance|abandon|reminder|rappel|follow.?up|winback|nudge', everything, re.I):
        add('À VÉRIFIER', 'Relances', 'Pas de relance des paiements non terminés', '(projet)',
            'Une partie des clients commence à payer puis abandonne (réseau, solde mobile money). Sans relance, ces ventes sont perdues.',
            'Un e-mail automatique 1 h puis 24 h après une commande restée « en attente », avec le lien pour reprendre.')
    autoconfirm = re.search(r'enable_confirmations\s*=\s*false|(?:GOTRUE_MAILER_AUTOCONFIRM|ENABLE_EMAIL_AUTOCONFIRM)\s*[:=]\s*[\'"]?true', everything)
    bonus = re.search(r'signup_bonus|welcome_credits|bonus.?(?:inscription|bienvenue)|free_credits', everything, re.I)
    if (bonus or has_free_credits) and autoconfirm:
        add('À VÉRIFIER', 'Abus', 'Crédits gratuits et inscription sans confirmation d’e-mail', '(projet)',
            'Si les crédits gratuits sont vraiment donnés à l’inscription, une même personne peut créer des dizaines de comptes avec de fausses adresses et utiliser le service gratuitement.',
            'Confirmer l’adresse e-mail avant de donner les crédits gratuits (SMTP configuré), ou ne les donner qu’après un premier geste réel.')


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    root = Path(sys.argv[1]).resolve()
    if not root.is_dir():
        sys.exit(f'Dossier introuvable : {root}')
    check_paid_features(root)
    check_credits(root)
    plans_found = check_pricing(root)
    has_free_credits = any(x['prix'] == 0 and x['credits'] for _, plans in plans_found for x in plans)
    check_revenue_leaks(root, has_free_credits)
    text, counts = base.report(root, findings, 'Scan de rentabilité automatique',
                               'Première passe automatique : ce que le CODE révèle des pertes d’argent. Les marges et le point mort se calculent ensuite avec les vrais coûts du propriétaire (calcul_rentabilite.py).')
    if plans_found:
        text += '\n## Offres trouvées dans le code\n'
        for r, plans in plans_found:
            text += f'\n`{r}`\n\n| Offre | Prix | Unités | Prix par unité |\n|---|---|---|---|\n'
            for x in plans:
                unit = f'{x["prix"] / x["credits"]:.4g}' if x['credits'] else '—'
                text += f'| {x["nom"]} | {x["prix"]:g} | {x["credits"] if x["credits"] is not None else "—"} | {unit} |\n'
    base.write_report(text, counts)


if __name__ == '__main__':
    main()
