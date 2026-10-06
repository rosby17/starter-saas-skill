#!/usr/bin/env python3
"""Pile qui n'est PAS Next.js (serveur Python + JavaScript maison, comme KappGen) : les scanners ne doivent pas crier au loup.

Appris de l'audit de KappGen (06/10/2026) : sur ce projet, la première passe donnait 0/100 avec 100 « failles » presque toutes fausses
(politique de confidentialité existante, limitation des tentatives existante, innerHTML toujours échappé, etc.).
1. Le projet « sain » ne doit déclencher AUCUN de ces faux signaux.
2. Le même projet sans échappeur, sans pages légales et sans limitation DOIT les déclencher (le scanner reste utile).

Usage : python3 tests/test_autre_pile.py
"""
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
COMPLET = HERE / 'scripts' / 'audit_complet.py'

SAIN = {
    'serveur.py': '''
ESSAIS = {}
def connexion(ident, mdp):
    if app.essais.bloque(ident):
        return erreur(429, "Trop d'essais.")
def route(chemin):
    if chemin == "/api/sante":
        return 200
    if chemin == "/confidentialite":
        return page("Politique de confidentialité : données collectées, durée, droits.")
    if chemin == "/conditions":
        return page("Conditions générales d'utilisation")
    if chemin == "/mentions-legales":
        return page("Mentions légales")
    if chemin == "/api/compte/supprimer":
        return supprimer_compte()
rapports.noter("erreur client", "message")
''',
    'interface/app.js': '''
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function rendre(titre) { document.getElementById('vue').innerHTML = `<h1>${esc(titre)}</h1>`; }
function encore(nom) { document.getElementById('x').innerHTML = `<b>${esc(nom)}</b>`; }
''',
    'interface/acces.js': '''
const echap = s => String(s).replace(/</g, '&lt;');
racine.innerHTML = `<p>${echap(message)}</p>`;
''',
    'interface/animation.tsx': "// la passe de mot de passe n'a rien à voir : passage 1 de l'animation\nconst x = { minLength: 1 }\n",
}

SANS_DEFENSE = {
    'serveur.py': 'def route(chemin):\n    return 200\n',
    'interface/app.js': "function rendre(titre) { document.getElementById('vue').innerHTML = `<h1>${titre}</h1>`; }\nconst email = 'inscription email'\n",
}

FAUX_SIGNAUX = ['Pas de politique de confidentialité', 'Aucune limitation du nombre de tentatives', 'Aucune adresse de contrôle de santé',
                'Les erreurs des clients ne sont remontées nulle part', 'Base de données sans migrations',
                'Exécution ou insertion de code dynamique', 'Mot de passe trop court']


def construire(fichiers):
    d = Path(tempfile.mkdtemp(prefix='audit-pile-'))
    for nom, contenu in fichiers.items():
        p = d / nom
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(contenu, encoding='utf-8')
    return d


def scanner(d):
    return subprocess.run([sys.executable, str(COMPLET), str(d), '--sortie', str(d / 'AUDIT.md')], capture_output=True, text=True, timeout=300).stdout


def main():
    ok = True
    sain = scanner(construire(SAIN))
    for t in FAUX_SIGNAUX:
        if t in sain:
            print(f'FAUSSE ALERTE  {t}')
            ok = False
    print(('OK    ' if ok else 'ÉCHEC ') + '  projet sain (Python + JS maison) : aucune fausse alerte')
    mauvais = scanner(construire(SANS_DEFENSE))
    attendus = ['Pas de politique de confidentialité', 'Aucune limitation du nombre de tentatives', 'Exécution ou insertion de code dynamique']
    for t in attendus:
        hit = t in mauvais
        print(('OK    ' if hit else 'ÉCHEC ') + f'  trouvé quand il manque : {t}')
        ok &= hit
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
