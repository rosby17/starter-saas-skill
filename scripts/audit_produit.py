#!/usr/bin/env python3
"""Scanner « produit » d'un SaaS : ce que les trois autres scanners ne regardent pas.

Usage : python3 audit_produit.py <dossier-du-projet> [--sortie rapport.md]

Domaines : authentification et comptes, API, données personnelles et pages légales,
expérience / design / accessibilité, performance et référencement, qualité du code.
Il ne modifie RIEN et n'exécute aucun code du projet. Chaque point est un SIGNAL à confirmer en lisant le code.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_securite as base  # noqa: E402  (mêmes outils : fichiers suivis par Git, lecture, rapport)

findings = []


def add(level, category, title, where, detail, fix):
    findings.append({'niveau': level, 'categorie': category, 'titre': title, 'ou': where, 'detail': detail, 'correction': fix})


def joined(code):
    return '\n'.join(code.values())


def first(root, code, pattern, flags=0):
    """Premier fichier (et sa ligne) qui contient le motif."""
    for p, text in code.items():
        m = re.search(pattern, text, flags)
        if m:
            return f'{base.rel(root, p)}:{base.line_of(text, m.start())}'
    return None


def pages(paths):
    """Chemins des pages (app/…/page.tsx, pages/…) : sert à savoir si une page existe."""
    return [p for p in paths if re.search(r'(^|/)(app|pages)/.*(page|index)\.(t|j)sx?$', p) or re.search(r'(^|/)pages/[^/]+\.(t|j)sx?$', p)]


def has_page(paths, *names):
    rx = re.compile(r'/(' + '|'.join(names) + r')(/|\.|$)', re.I)
    return any(rx.search(p) for p in pages(paths))


def has_route(root, *names):
    """Pile qui n'est pas Next.js : la page (ou la route du serveur) existe-t-elle quelque part dans le projet ? (« /confidentialite », « /legal »…)"""
    rx = re.compile(r'[\'"`/](?:' + '|'.join(names) + r')[\'"`/\s<>#?]', re.I)
    return bool(rx.search(base.texte_projet(root)))


# ---------------------------------------------------------------------------
# Authentification et comptes
# ---------------------------------------------------------------------------
def check_auth(root, code, paths):
    all_code = joined(code)
    uses_auth = re.search(r'supabase\.auth|next-auth|NextAuth|@clerk|lucia|better-auth|signIn|signUp|login', all_code, re.I)
    if not uses_auth:
        return
    if not re.search(r'signOut|logout|log-out|sign-out|déconnexion|deconnexion|signout', all_code, re.I):
        add('HAUTE', 'Authentification', 'Aucune déconnexion', '(projet)',
            'Un client sur un ordinateur partagé ne peut pas fermer sa session : le suivant entre dans son compte.',
            'Un bouton « Se déconnecter » visible dans l’espace client, qui appelle signOut() côté serveur (route POST) et renvoie vers /login.')
    if not re.search(r'resetPasswordForEmail|forgot|reset-password|mot de passe oublié|password reset|sendPasswordReset', all_code, re.I):
        add('MOYENNE', 'Authentification', 'Pas de « mot de passe oublié »', '(projet)',
            'Un client qui oublie son mot de passe est perdu (et écrit au support, ou part).',
            'Page /reset-password : envoi du lien par e-mail, puis page de nouveau mot de passe.')
    for p, text in code.items():
        for m in re.finditer(r'(minLength\s*=\s*\{?\s*|\.min\(\s*|password\.length\s*<\s*)([1-7])\b', text):
            ctx = text[max(0, m.start() - 200):m.end() + 50].lower()
            if re.search(r'password|passwd|mot[ _-]?de[ _-]?passe|motdepasse|\bmdp\b', ctx):
                add('MOYENNE', 'Authentification', f'Mot de passe trop court accepté ({m.group(2)} caractères)', f'{base.rel(root, p)}:{base.line_of(text, m.start())}',
                    'Les mots de passe courts se devinent en quelques minutes.', 'Imposer 8 caractères au minimum (10 pour un compte administrateur), côté serveur aussi.')
                break
    # getSession() côté serveur : la session n'est pas revérifiée auprès du serveur d'authentification.
    for p, text in code.items():
        r = base.rel(root, p)
        if 'use client' in text[:200]:
            continue
        if re.search(r'auth\.getSession\(\)', text) and not re.search(r'auth\.getUser\(\)|getClaims\(\)', text):
            if re.search(r'middleware|route\.(t|j)s|/api/|server|actions?\.(t|j)s|layout|page\.(t|j)sx', r):
                add('HAUTE', 'Authentification', 'Identité lue avec getSession() côté serveur', f'{r}:{base.line_of(text, text.find("getSession"))}',
                    'getSession() lit le cookie sans le revérifier : un cookie fabriqué peut se faire passer pour un autre client.',
                    'Côté serveur, utiliser supabase.auth.getUser() (ou getClaims()) pour toute décision d’accès.')
    cfg = root / 'supabase' / 'config.toml'
    if cfg.exists():
        t = base.read(cfg)
        if re.search(r'^\s*enable_confirmations\s*=\s*false', t, re.M):
            add('À VÉRIFIER', 'Authentification', 'Adresse e-mail jamais confirmée', 'supabase/config.toml',
                'N’importe qui peut s’inscrire avec l’adresse d’un autre ; les e-mails du SaaS partent vers des inconnus.',
                'Activer la confirmation d’e-mail dès que l’envoi d’e-mails (SMTP) est réglé en production.')
    if not has_page(paths, 'login', 'signin', 'sign-in', 'connexion', 'auth') and not re.search(r'signInWith|signIn\(', all_code):
        add('À VÉRIFIER', 'Authentification', 'Page de connexion introuvable', '(projet)', 'Le parcours de connexion n’a pas été trouvé.', 'Vérifier à la main inscription → connexion → déconnexion.')


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
def check_api(root, code):
    unvalidated = []
    for p, text in code.items():
        r = base.rel(root, p)
        if not re.search(r'(^|/)(app/api/.+/route|pages/api/.+)\.(t|j)s$', r):
            continue
        if re.search(r'(request|req)\.(json|formData)\(\)|req\.body', text) and not re.search(
                r'\bz\.\w|zod|valibot|yup|joi|safeParse|typeof\s+\w+(\??\.\w+)*\s*[!=]==\s*[\'"]|Number\.is|isUuid|RE_|\.test\(', text):
            unvalidated.append(r)
        m = next((x for x in re.finditer(r'json\(\s*\{[^}]*\b(error|message|detail)\s*:\s*(\w+)\.(message|stack)\b', text)
                  if not re.search(r'instanceof\s+\w*(Error|Exception)\b[^\n]*$', text[max(0, x.start() - 200):x.start()])), None)  # erreurs « métier » voulues
        if m:
            add('MOYENNE', 'API', 'Message d’erreur interne renvoyé au client', f'{r}:{base.line_of(text, m.start())}',
                'Le texte brut d’une erreur (base, passerelle, pile d’appel) révèle la structure interne et aide un attaquant.',
                'Journaliser l’erreur côté serveur et renvoyer un message générique (« Une erreur est survenue »).')
        g = re.search(r'export\s+(async\s+)?function\s+GET\b[\s\S]{0,1500}?\n\}', text)
        if g and re.search(r'\.(insert|update|delete|upsert)\(|DELETE FROM|UPDATE\s+\w+\s+SET|INSERT INTO', g.group(0)):
            add('MOYENNE', 'API', 'Une requête GET modifie des données', f'{r}:{base.line_of(text, g.start())}',
                'Un simple lien, une image ou un préchargement du navigateur suffit à déclencher l’action (CSRF).',
                'Passer ces actions en POST (ou PUT/DELETE) et garder GET pour la lecture.')
    if unvalidated:
        add('À VÉRIFIER', 'API', f'{len(unvalidated)} route(s) qui lisent le corps de la requête sans validation visible',
            ', '.join(unvalidated[:6]) + (' …' if len(unvalidated) > 6 else ''),
            'Des champs inattendus, trop longs ou du mauvais type peuvent planter la route ou passer dans la base.',
            'Valider chaque entrée avec un schéma (zod) : types, longueurs maximales, valeurs permises.')


# ---------------------------------------------------------------------------
# Données personnelles et pages légales
# ---------------------------------------------------------------------------
def check_legal(root, code, paths):
    all_code = joined(code)
    collects = re.search(r'email|e-mail|signUp|inscription', all_code, re.I)
    if not collects:
        return
    if not has_page(paths, 'privacy', 'confidentialite', 'confidentialité', 'politique-de-confidentialite', 'privacy-policy', 'donnees-personnelles') \
            and not has_route(root, 'privacy', 'confidentialite', 'politique-de-confidentialite', 'privacy-policy', 'donnees-personnelles'):
        add('HAUTE', 'Données personnelles', 'Pas de politique de confidentialité', '(projet)',
            'Obligatoire dès qu’on collecte une adresse e-mail (RGPD, lois africaines sur les données) ; exigée aussi par Google, Stripe, les stores.',
            'Page /confidentialite : données collectées, finalités, durée de conservation, sous-traitants, droits et contact.')
    if not has_page(paths, 'terms', 'cgu', 'cgv', 'conditions', 'legal', 'mentions-legales') and not has_route(root, 'terms', 'cgu', 'cgv', 'conditions', 'legal', 'mentions-legales'):
        add('MOYENNE', 'Données personnelles', 'Pas de conditions d’utilisation / de vente', '(projet)',
            'Sans conditions, rien ne cadre les remboursements, les abus ni la responsabilité.', 'Pages CGU / CGV (et mentions légales) liées dans le pied de page.')
    if not re.search(r'deleteUser|delete-account|delete_account|supprimer (mon|le|son) compte|suppression du compte|account deletion', all_code, re.I):
        add('HAUTE', 'Données personnelles', 'Le client ne peut pas supprimer son compte', '(projet)',
            'Le droit à l’effacement est obligatoire (RGPD) ; Apple et Google l’exigent pour toute application liée.',
            'Bouton « Supprimer mon compte » dans Mon compte (confirmation, suppression ou anonymisation des données, auth.admin.deleteUser).')
    if not re.search(r'export(er)? (mes|les) données|data export|exportData|download.?my.?data|télécharger mes données', all_code, re.I):
        add('À VÉRIFIER', 'Données personnelles', 'Pas d’export des données du client', '(projet)',
            'Le droit à la portabilité demande de pouvoir récupérer ses données.', 'Bouton « Télécharger mes données » (JSON ou CSV) dans Mon compte.')
    tracker = first(root, code, r'googletagmanager|gtag\(|fbq\(|connect\.facebook\.net|hotjar|clarity\.ms|mixpanel|segment\.com')
    if tracker and not re.search(r'consent|cookie.?banner|tarteaucitron|cookiebot|axeptio|didomi', all_code, re.I):
        add('MOYENNE', 'Données personnelles', 'Traceurs publicitaires sans consentement', tracker,
            'Les traceurs (Google, Facebook…) ne peuvent être posés qu’après accord du visiteur en Europe.',
            'Bandeau de consentement aux couleurs du site, traceurs chargés seulement après « Accepter ».')


# ---------------------------------------------------------------------------
# Expérience, design et accessibilité
# ---------------------------------------------------------------------------
NATIVE = [
    (r'<select\b', 'liste déroulante du navigateur (<select>)', 'Select'),
    (r'type=["\'](date|time|datetime-local|month|week)["\']', 'calendrier du navigateur', 'DatePicker'),
    (r'type=["\'](radio|checkbox|color|range)["\']', 'case ou bouton radio du navigateur', 'RadioCard / Checkbox / Switch'),
    (r'(?<![\w.])(alert|confirm|prompt)\(|window\.(alert|confirm|prompt)\(', 'fenêtre du navigateur (alert/confirm/prompt)', 'useConfirm / message dans la page'),
]


def check_ux(root, code, paths):
    ui = {p: t for p, t in code.items() if p.suffix in ('.tsx', '.jsx')}
    hits = {}
    for p, text in ui.items():
        r = base.rel(root, p)
        if re.search(r'(^|/)components/ui/', r):
            continue
        own = set(re.findall(r'const\s+(alert|confirm|prompt)\s*=', text))  # ex. const confirm = useConfirm()
        for rx, label, repl in NATIVE:
            for m in re.finditer(rx, text):
                if m.group(0).rstrip('(').split('.')[-1] in own:
                    continue
                hits.setdefault((label, repl), []).append(f'{r}:{base.line_of(text, m.start())}')
    for (label, repl), where in hits.items():
        add('MOYENNE', 'Design', f'Élément natif du navigateur : {label} ({len(where)})', ', '.join(where[:5]) + (' …' if len(where) > 5 else ''),
            'Il affiche le style du système (gris, macOS ou Windows), pas celui du SaaS : l’interface paraît bricolée.',
            f'Remplacer par un composant aux couleurs du site ({repl}).')
    bare_pw = [f'{base.rel(root, p)}:{base.line_of(t, m.start())}' for p, t in ui.items() if not re.search(r'(^|/)components/ui/', base.rel(root, p))
               for m in re.finditer(r'type=["\']password["\']', t)]
    if bare_pw:
        add('MOYENNE', 'Expérience', f'Mot de passe sans bouton pour l’afficher ({len(bare_pw)})', ', '.join(bare_pw[:5]),
            'Le client ne voit pas ce qu’il tape : fautes de frappe, comptes bloqués, abandons à l’inscription.',
            'Un champ mot de passe avec un œil pour afficher / masquer (composant PasswordInput).')
    no_alt = []
    for p, text in ui.items():
        for m in re.finditer(r'<img\b(?![^>]*\balt=)[^>]*>', text):
            no_alt.append(f'{base.rel(root, p)}:{base.line_of(text, m.start())}')
    if no_alt:
        add('MOYENNE', 'Accessibilité', f'Images sans texte alternatif ({len(no_alt)})', ', '.join(no_alt[:5]),
            'Les lecteurs d’écran ne savent pas ce qu’elles montrent ; Google non plus.', 'Ajouter alt="…" (alt="" pour une image décorative).')
    layout = next((t for p, t in code.items() if re.search(r'(^|/)app/layout\.(t|j)sx$', base.rel(root, p))), None)
    if layout is not None and not re.search(r'<html[^>]*\blang=', layout):
        add('MOYENNE', 'Accessibilité', 'Langue de la page non indiquée', 'app/layout', 'Les lecteurs d’écran lisent le français avec l’accent anglais ; la traduction automatique se trompe.', 'Ajouter <html lang="fr">.')
    clickable_div = []
    for p, text in ui.items():
        for m in re.finditer(r'<(div|span)\b(?![^>]*\brole=)[^>]*\bonClick=', text):
            clickable_div.append(f'{base.rel(root, p)}:{base.line_of(text, m.start())}')
    if len(clickable_div) > 2:
        add('À VÉRIFIER', 'Accessibilité', f'Zones cliquables qui ne sont pas des boutons ({len(clickable_div)})', ', '.join(clickable_div[:5]),
            'Impossible à atteindre au clavier, invisibles pour les lecteurs d’écran.', 'Utiliser <button> (ou role="button" + tabIndex + touche Entrée), sauf pour un fond qui ferme une fenêtre.')
    if any('/app/' in '/' + p for p in paths):
        if not any(re.search(r'(^|/)app/not-found\.(t|j)sx$', p) for p in paths):
            add('MOYENNE', 'Expérience', 'Pas de page « introuvable » personnalisée', '(projet)', 'Une adresse erronée affiche la page brute de Next.js, sans menu pour revenir.', 'Créer app/not-found.tsx avec la charte et un lien vers l’accueil.')
        if not any(re.search(r'(^|/)loading\.(t|j)sx$', p) for p in paths) and not re.search(r'Skeleton|animate-pulse|animate-spin|Chargement', joined(ui)):
            add('À VÉRIFIER', 'Expérience', 'Aucun état de chargement', '(projet)', 'Pendant un chargement, l’écran reste figé : le client clique deux fois ou croit que c’est cassé.', 'loading.tsx ou squelettes pendant les chargements, boutons désactivés pendant l’envoi.')


# ---------------------------------------------------------------------------
# Performance et référencement
# ---------------------------------------------------------------------------
def check_perf_seo(root, code, paths):
    all_code = joined(code)
    is_next = (root / 'next.config.ts').exists() or (root / 'next.config.js').exists() or (root / 'next.config.mjs').exists()
    if is_next:
        if not re.search(r'export\s+(const|async function)\s+(metadata|generateMetadata)', all_code):
            add('MOYENNE', 'Référencement', 'Aucun titre ni description pour Google', '(projet)', 'Google et les réseaux sociaux affichent l’adresse brute au lieu d’un titre accrocheur.', 'export const metadata = { title, description, openGraph } dans app/layout.tsx et les pages publiques.')
        elif not re.search(r'openGraph', all_code):
            add('À VÉRIFIER', 'Référencement', 'Pas d’aperçu pour les réseaux sociaux (Open Graph)', '(projet)', 'Un lien partagé sur WhatsApp ou Facebook s’affiche sans image ni titre.', 'Ajouter openGraph (titre, description, image 1200×630) dans metadata.')
        if not any(re.search(r'(^|/)(app/sitemap\.(t|j)s|public/sitemap\.xml)$', p) for p in paths):
            add('MOYENNE', 'Référencement', 'Pas de sitemap', '(projet)', 'Google découvre les pages moins vite.', 'app/sitemap.ts qui liste les pages publiques.')
        if not any(re.search(r'(^|/)(app/robots\.(t|j)s|public/robots\.txt)$', p) for p in paths):
            add('MOYENNE', 'Référencement', 'Pas de robots.txt', '(projet)', 'Google peut indexer l’espace client et l’administration.', 'app/robots.ts : autoriser les pages publiques, interdire /admin, /dashboard et /api.')
        raw_img = sum(len(re.findall(r'<img\b', t)) for p, t in code.items() if p.suffix in ('.tsx', '.jsx'))
        if raw_img > 3:
            add('À VÉRIFIER', 'Performance', f'{raw_img} images sans optimisation (<img>)', '(projet)', 'Images trop lourdes sur téléphone : page lente, moins bien classée.', 'Utiliser next/image (formats modernes, tailles adaptées, chargement différé).')
        if re.search(r'fonts\.googleapis\.com', all_code):
            add('À VÉRIFIER', 'Performance', 'Police chargée depuis Google Fonts', first(root, code, r'fonts\.googleapis\.com') or '(projet)', 'Requête externe qui ralentit l’affichage et transmet l’adresse IP des visiteurs à Google.', 'Charger la police avec next/font (hébergée avec le site).')
    heavy = []
    for p in base.files(root):
        r = base.rel(root, p)
        if r.startswith('public/') and p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4') and p.stat().st_size > 800_000:
            heavy.append(f'{r} ({p.stat().st_size // 1024} Ko)')
    if heavy:
        add('MOYENNE', 'Performance', f'Fichiers très lourds dans public/ ({len(heavy)})', ', '.join(heavy[:5]), 'Téléchargés à chaque visite : pages lentes sur mobile et données mobiles gaspillées.', 'Compresser (WebP/AVIF, vidéo en streaming) et redimensionner.')


# ---------------------------------------------------------------------------
# Qualité du code et capacité à évoluer
# ---------------------------------------------------------------------------
def check_quality(root, code, paths):
    if not any(re.match(r'readme(\.md)?$', p, re.I) for p in paths):
        add('MOYENNE', 'Qualité', 'Pas de README', '(projet)', 'Personne (ni un développeur, ni Claude) ne sait lancer, régler ou déployer le projet.', 'README : lancer en local, variables, déploiement, où changer quoi.')
    if (root / 'package.json').exists() and not any(re.search(r'(^|/)\.env\.example$', p) for p in paths):
        add('MOYENNE', 'Qualité', 'Pas de .env.example', '(projet)', 'Impossible de savoir quelles clés le projet attend : chaque installation devient une enquête.', 'Lister chaque variable (sans valeur réelle) avec un commentaire.')
    if (root / 'package.json').exists() and not any(re.search(r'(^|/)(eslint\.config\.\w+|\.eslintrc(\.\w+)?)$', p) for p in paths):
        add('À VÉRIFIER', 'Qualité', 'Pas de vérificateur de code (ESLint)', '(projet)', 'Les erreurs courantes ne sont repérées qu’en production.', 'eslint.config.mjs (next/core-web-vitals, next/typescript) et npm run lint avant chaque mise en ligne.')
    big = [(base.rel(root, p), t.count('\n')) for p, t in code.items() if t.count('\n') > 800]
    if big:
        big.sort(key=lambda x: -x[1])
        add('À VÉRIFIER', 'Qualité', f'Fichiers géants ({len(big)})', ', '.join(f'{r} ({n} lignes)' for r, n in big[:5]),
            'Un fichier de plus de 800 lignes est difficile à relire et à modifier sans casser autre chose.', 'Le découper par responsabilité (composants, fonctions utilitaires, routes).')
    anys = sum(len(re.findall(r':\s*any\b|as any\b', t)) for t in code.values())
    if anys > 30:
        add('À VÉRIFIER', 'Qualité', f'{anys} types « any »', '(projet)', 'TypeScript ne protège plus ces endroits : les erreurs apparaissent chez le client.', 'Typer les données (types de la base générés, schémas zod).')
    serveur_bd = re.search(r'"(?:@supabase/[\w-]+|@prisma/client|prisma|drizzle-orm|pg|postgres)"', base.read(root / 'package.json')) or re.search(r'from [\'"](?:pg|postgres|@supabase/[\w-]+|@prisma/client|drizzle-orm)[\'"]', joined(code))
    if not any(re.search(r'(^|/)(supabase/migrations|migrations|prisma/migrations|drizzle)/', p) for p in paths) and serveur_bd:
        add('MOYENNE', 'Qualité', 'Base de données sans migrations', '(projet)', 'La structure de la base n’est écrite nulle part : impossible de la recréer ou de la faire évoluer sans risque.', 'Un fichier de migration par changement, versionné dans Git.')


# ---------------------------------------------------------------------------
def scan(root):
    code = {p: base.read(p) for p in base.files(root, base.CODE_EXT)}
    paths = [base.rel(root, p) for p in base.files(root)]
    check_auth(root, code, paths)
    check_api(root, code)
    check_legal(root, code, paths)
    check_ux(root, code, paths)
    check_perf_seo(root, code, paths)
    check_quality(root, code, paths)
    return findings


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    root = Path(sys.argv[1]).resolve()
    if not root.is_dir():
        sys.exit(f'Dossier introuvable : {root}')
    scan(root)
    base.write_report(*base.report(root, findings, 'Scan produit automatique',
                                   'Première passe automatique : authentification, API, données personnelles, design et accessibilité, performance et référencement, qualité du code. Chaque point est un SIGNAL à confirmer en lisant le code.'))


if __name__ == '__main__':
    main()
