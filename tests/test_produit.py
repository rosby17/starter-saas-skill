#!/usr/bin/env python3
"""Test du scanner produit (audit_produit.py) et de l'audit complet (audit_complet.py).

1. Faux SaaS plein de défauts connus (auth, API, légal, design, référencement, qualité) : chacun doit être trouvé.
2. Version corrigée du même SaaS : aucun de ces signaux ne doit sortir.
3. L'audit complet range bien les signaux dans les 11 domaines et produit le tableau du chat.

Usage : python3 tests/test_produit.py
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
PRODUIT = HERE / 'scripts' / 'audit_produit.py'
COMPLET = HERE / 'scripts' / 'audit_complet.py'

FLAWED = {
    'package.json': '{"name": "saas-bancal", "dependencies": {"next": "15.5.0", "@supabase/ssr": "0.12.0"}}',
    'next.config.ts': 'export default {}\n',
    'src/middleware.ts': "export async function middleware() { const { data } = await supabase.auth.getSession(); return data }\n",
    'src/app/layout.tsx': "export default function L({ children }) { return <html><body>{children}</body></html> }\n",
    'src/app/login/page.tsx': """export default function Login() {
  async function go(f) { await supabase.auth.signInWithPassword({ email: f.email, password: f.password }) }
  return <form><input name="email" /><input name="password" type="password" minLength={6} /></form>
}
""",
    'src/app/signup/page.tsx': "export default function S() { return <p>inscription email</p> }\n",
    'src/app/dashboard/page.tsx': """export default function D() {
  const del = () => { if (confirm('Supprimer ?')) fetch('/api/items', { method: 'DELETE' }) }
  return <div>
    <select><option>Toutes</option></select>
    <input type="date" />
    <img src="/hero.png" />
    <div onClick={del}>x</div><div onClick={del}>y</div><span onClick={del}>z</span>
    <script src="https://www.googletagmanager.com/gtag/js?id=G-1" />
  </div>
}
""",
    'src/app/api/items/route.ts': """export async function GET(req: Request) {
  await db.from('items').delete().eq('old', true)
  return Response.json({ ok: true })
}
export async function POST(req: Request) {
  try {
    const body = await req.json()
    await db.from('items').insert(body)
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
""",
    'src/lib/db.ts': "import { createClient } from '@supabase/supabase-js'\nexport const db = createClient('x', 'y')\n",
}

EXPECTED = [
    'Aucune déconnexion',
    'Pas de « mot de passe oublié »',
    'Mot de passe trop court accepté',
    'Identité lue avec getSession() côté serveur',
    'Message d’erreur interne renvoyé au client',
    'Une requête GET modifie des données',
    'route(s) qui lisent le corps de la requête sans validation visible',
    'Pas de politique de confidentialité',
    'Pas de conditions d’utilisation',
    'Le client ne peut pas supprimer son compte',
    'Pas d’export des données du client',
    'Traceurs publicitaires sans consentement',
    'liste déroulante du navigateur',
    'calendrier du navigateur',
    'fenêtre du navigateur',
    'Images sans texte alternatif',
    'Mot de passe sans bouton pour l’afficher',
    'Langue de la page non indiquée',
    'Zones cliquables qui ne sont pas des boutons',
    'Pas de page « introuvable » personnalisée',
    'Aucun titre ni description pour Google',
    'Pas de sitemap',
    'Pas de robots.txt',
    'Pas de README',
    'Pas de .env.example',
    'Base de données sans migrations',
]

FIXED = {
    'package.json': FLAWED['package.json'],
    'README.md': '# SaaS\n',
    '.env.example': 'NEXT_PUBLIC_SUPABASE_URL=\n',
    'eslint.config.mjs': 'export default []\n',
    'supabase/migrations/0001_init.sql': 'create table items (id uuid primary key);\n',
    'next.config.ts': FLAWED['next.config.ts'],
    'src/middleware.ts': "export async function middleware() { const { data } = await supabase.auth.getUser(); return data }\n",
    'src/app/layout.tsx': """export const metadata = { title: 'SaaS', description: 'd', openGraph: { title: 'SaaS' } }
export default function L({ children }) { return <html lang="fr"><body>{children}</body></html> }
""",
    'src/app/sitemap.ts': 'export default function sitemap() { return [] }\n',
    'src/app/robots.ts': 'export default function robots() { return {} }\n',
    'src/app/not-found.tsx': 'export default function N() { return <p>Introuvable</p> }\n',
    'src/app/loading.tsx': 'export default function C() { return <p>Chargement</p> }\n',
    'src/app/confidentialite/page.tsx': 'export default function P() { return <p>Confidentialité</p> }\n',
    'src/app/cgu/page.tsx': 'export default function P() { return <p>CGU</p> }\n',
    'src/app/login/page.tsx': """export default function Login() {
  async function go(f) { await supabase.auth.signInWithPassword({ email: f.email, password: f.password }) }
  return <form><input name="email" /><PasswordInput name="password" minLength={10} /><a href="/reset-password">Mot de passe oublié</a></form>
}
""",
    'src/app/signup/page.tsx': FLAWED['src/app/signup/page.tsx'],
    'src/app/dashboard/page.tsx': """import { useConfirm } from '@/components/ui/dialog'
export default function D() {
  const confirm = useConfirm()
  const del = async () => { if (await confirm({ title: 'Supprimer ?' })) fetch('/api/items', { method: 'DELETE' }) }
  return <div>
    <Select options={[]} /><DatePicker value="" />
    <img src="/hero.png" alt="Aperçu" />
    <button onClick={del}>x</button>
    <button onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
    <a href="/api/account">Télécharger mes données</a> <button>Supprimer mon compte</button>
  </div>
}
""",
    'src/app/api/items/route.ts': """import { z } from 'zod'
export async function GET(req: Request) {
  const { data } = await db.from('items').select('*').limit(50)
  return Response.json({ data })
}
export async function POST(req: Request) {
  try {
    const body = z.object({ name: z.string().max(80) }).parse(await req.json())
    await db.from('items').insert(body)
    return Response.json({ ok: true })
  } catch (error) {
    console.error(error)
    return Response.json({ error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
""",
    'src/lib/db.ts': FLAWED['src/lib/db.ts'],
}


def build(files):
    d = Path(tempfile.mkdtemp(prefix='audit-produit-'))
    for name, content in files.items():
        p = d / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding='utf-8')
    return d


def scan(d):
    out = subprocess.run([sys.executable, str(PRODUIT), str(d)], capture_output=True, text=True, timeout=120)
    return out.stdout


def main():
    ok = True
    flawed = scan(build(FLAWED))
    found = 0
    for title in EXPECTED:
        hit = title in flawed
        found += hit
        print(('OK    ' if hit else 'ÉCHEC ') + f'  {title}')
        ok &= hit
    print(f'\nProduit, défauts trouvés : {found}/{len(EXPECTED)}\n')

    fixed = scan(build(FIXED))
    clean = 0
    for title in EXPECTED:
        hit = title in fixed
        clean += not hit
        if hit:
            print(f'FAUSSE ALERTE  {title}')
        ok &= not hit
    print(f'Produit, SaaS corrigé sans fausse alerte : {clean}/{len(EXPECTED)}\n')

    d = build(FLAWED)
    data = json.loads(subprocess.run([sys.executable, str(COMPLET), str(d), '--json'], capture_output=True, text=True, timeout=300).stdout)
    domains = {f['domaine'] for f in data['findings']}
    need = {'auth', 'api', 'legal', 'ux', 'perf', 'qualite'}
    chat = subprocess.run([sys.executable, str(COMPLET), str(d)], capture_output=True, text=True, timeout=300).stdout
    complete = need <= domains and '| Authentification et comptes |' in chat and '### API et intégrations' in chat and data['score'] < 50
    print(('OK    ' if complete else 'ÉCHEC ') + f"  audit complet : domaines {sorted(domains)}, note {data['score']}/100")
    ok &= complete
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
