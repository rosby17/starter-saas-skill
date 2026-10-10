#!/usr/bin/env python3
"""Audit COMPLET d'un SaaS : les 4 scanners, rangés en 11 domaines, avec une note.

Usage : python3 audit_complet.py <dossier-du-projet> [--sortie AUDIT-COMPLET.md] [--json]

- Affiche le RÉSUMÉ À METTRE DANS LE CHAT (tableau des 11 domaines, puis les failles domaine par domaine).
- Avec --sortie : écrit aussi le rapport détaillé (risque et correction de chaque point, + la liste des
  vérifications manuelles de references/checklist-saas.md à cocher).
Il ne modifie RIEN et n'exécute aucun code du projet. Les signaux se confirment ensuite en lisant le code.
"""
import io
import json
import sys
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import audit_securite  # noqa: E402
import audit_rentabilite  # noqa: E402
import audit_robustesse  # noqa: E402
import audit_produit  # noqa: E402

ORDER = ['CRITIQUE', 'HAUTE', 'MOYENNE', 'À VÉRIFIER']
POINTS = {'CRITIQUE': 25, 'HAUTE': 10, 'MOYENNE': 3, 'À VÉRIFIER': 0}

# Les 11 domaines d'un bon SaaS (même ordre que references/checklist-saas.md).
DOMAINS = [
    ('auth', 'Authentification et comptes'),
    ('acces', 'Droits d’accès et données des clients'),
    ('paiement', 'Paiements et facturation'),
    ('api', 'API et intégrations'),
    ('secu', 'Sécurité technique'),
    ('robu', 'Robustesse et exploitation'),
    ('renta', 'Rentabilité'),
    ('legal', 'Données personnelles et légal'),
    ('ux', 'Expérience, design et accessibilité'),
    ('perf', 'Performance et référencement'),
    ('qualite', 'Qualité du code et évolutivité'),
]
LABEL = dict(DOMAINS)


def domain_of(source, f):
    c, t = f['categorie'], f['titre'].lower()
    if source == 'securite':
        if c in ('Accès', 'Base de données'):
            return 'acces'
        if c == 'Paiement':
            return 'paiement'
        if c == 'Abus' and 'tentatives' in t:
            return 'auth'
        if c == 'Navigateur' and 'cors' in t:
            return 'api'
        return 'secu'
    if source == 'rentabilite':
        if c == 'Paiements':
            return 'paiement'
        if c == 'Abus':
            return 'auth'
        return 'renta'
    if source == 'robustesse':
        return 'qualite' if c == 'Qualité' else 'robu'
    return {'Authentification': 'auth', 'API': 'api', 'Données personnelles': 'legal', 'Design': 'ux', 'Accessibilité': 'ux',
            'Expérience': 'ux', 'Référencement': 'perf', 'Performance': 'perf', 'Qualité': 'qualite'}.get(c, 'qualite')


def payment_lock_findings(root):
    """Page de paiement du kit : obligatoire sur tout SaaS web audité (references/paiement-verrouille.md)."""
    root = Path(root)
    if not (root / 'package.json').exists():
        return []
    fix = 'Installer la brique : bash <skill>/scripts/installer-paiement.sh <projet>, puis adapter le site autour (jamais l’inverse).'
    base = {'categorie': 'Paiement', 'domaine': 'paiement', 'source': 'paiement'}
    lock = root / 'paiement.lock.json'
    if not lock.exists():
        return [{**base, 'niveau': 'HAUTE', 'titre': 'Page de paiement non conforme au kit (aucun verrou)', 'ou': 'paiement.lock.json',
                 'detail': 'Le site n’a pas la page de paiement validée du kit (Mobile Money en FCFA, Wave, carte, PayPal, crypto, livraison atomique, facture).', 'correction': fix}]
    import hashlib, json
    try:
        files = json.loads(lock.read_text(encoding='utf-8'))['files']
    except Exception:
        return [{**base, 'niveau': 'HAUTE', 'titre': 'Verrou de paiement illisible', 'ou': 'paiement.lock.json', 'detail': 'Fichier abîmé.', 'correction': fix}]
    bad = [p for p, h in files.items() if not (root / p).exists()
           or hashlib.sha256((root / p).read_text(encoding='utf-8').replace('\r\n', '\n').encode()).hexdigest() != h]
    if bad:
        return [{**base, 'niveau': 'HAUTE', 'titre': f'Page de paiement modifiée ({len(bad)} fichier(s) verrouillé(s))', 'ou': ', '.join(bad[:5]),
                 'detail': 'La brique de paiement commune a été modifiée dans le projet : comportement non validé, build bloqué.', 'correction': 'Revenir aux fichiers du kit (réinstaller la brique) ; une amélioration se fait dans le kit.'}]
    return []


def collect(root):
    out = []
    with redirect_stdout(io.StringIO()):  # les scanners écrivent parfois des messages : on les garde pour le rapport
        audit_securite.scan(root)
        audit_rentabilite.scan(root)
        audit_robustesse.scan(root)
        audit_produit.scan(root)
    for source, mod in (('securite', audit_securite), ('rentabilite', audit_rentabilite), ('robustesse', audit_robustesse), ('produit', audit_produit)):
        for f in mod.findings:
            out.append({**f, 'domaine': domain_of(source, f), 'source': source})
    out += payment_lock_findings(root)
    # Un même problème vu par deux scanners n'apparaît qu'une fois.
    seen, unique = set(), []
    for f in out:
        key = (f['titre'], f['ou'])
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique


def score(findings):
    return max(0, 100 - sum(POINTS[f['niveau']] for f in findings))


def state(findings):
    levels = {f['niveau'] for f in findings}
    if 'CRITIQUE' in levels or 'HAUTE' in levels:
        return '✗ à corriger'
    if 'MOYENNE' in levels:
        return '⚠ à améliorer'
    if 'À VÉRIFIER' in levels:
        return '? à vérifier'
    return '✓ conforme'


def chat_summary(root, findings):
    by = {d: [f for f in findings if f['domaine'] == d] for d, _ in DOMAINS}
    total = score(findings)
    lines = [f'## Audit de {root.name} : {total}/100', '',
             '| Domaine | État | Critique | Haute | Moyenne | À vérifier |', '|---|---|---|---|---|---|']
    for d, label in DOMAINS:
        fs = by[d]
        c = {lvl: sum(1 for f in fs if f['niveau'] == lvl) for lvl in ORDER}
        lines.append(f"| {label} | {state(fs)} | {c['CRITIQUE'] or ''} | {c['HAUTE'] or ''} | {c['MOYENNE'] or ''} | {c['À VÉRIFIER'] or ''} |")
    urgent = sorted([f for f in findings if f['niveau'] in ('CRITIQUE', 'HAUTE')], key=lambda f: ORDER.index(f['niveau']))[:3]
    if urgent:
        lines += ['', '**Les urgences** :'] + [f"{i}. **{f['titre']}** ({LABEL[f['domaine']]}) : {f['correction']}" for i, f in enumerate(urgent, 1)]
    for d, label in DOMAINS:
        fs = sorted(by[d], key=lambda f: ORDER.index(f['niveau']))
        if not fs:
            continue
        lines += ['', f'### {label}']
        for f in fs:
            lines.append(f"- **[{f['niveau']}]** {f['titre']} — `{f['ou']}`")
    lines += ['', '_Signaux automatiques, à confirmer en lisant le code. La revue manuelle (references/checklist-saas.md) complète ce tableau._']
    return '\n'.join(lines)


def full_report(root, findings):
    text = [f'# Audit complet : {root.name}', '', f'Note automatique : **{score(findings)}/100** (CRITIQUE −25, HAUTE −10, MOYENNE −3).', '']
    for d, label in DOMAINS:
        fs = sorted([f for f in findings if f['domaine'] == d], key=lambda f: ORDER.index(f['niveau']))
        text += [f'## {label} — {state(fs)}', '']
        if not fs:
            text += ['Aucun signal automatique. Passer quand même les vérifications manuelles de ce domaine.', '']
        for f in fs:
            text += [f"### [{f['niveau']}] {f['titre']}", f"- **Où** : `{f['ou']}`", f"- **Risque** : {f['detail']}", f"- **Correction** : {f['correction']}", '']
    checklist = HERE.parent / 'references' / 'checklist-saas.md'
    if checklist.exists():
        text += ['---', '', '# Vérifications manuelles à cocher', '', checklist.read_text(encoding='utf-8').split('\n', 1)[1]]
    return '\n'.join(text)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    root = Path(sys.argv[1]).resolve()
    if not root.is_dir():
        sys.exit(f'Dossier introuvable : {root}')
    findings = collect(root)
    if '--json' in sys.argv:
        print(json.dumps({'score': score(findings), 'findings': findings}, ensure_ascii=False, indent=2))
        return
    if '--sortie' in sys.argv:
        dest = Path(sys.argv[sys.argv.index('--sortie') + 1])
        dest.write_text(full_report(root, findings), encoding='utf-8')
        print(f'Rapport détaillé écrit : {dest}\n', file=sys.stderr)
    print(chat_summary(root, findings))


if __name__ == '__main__':
    main()
