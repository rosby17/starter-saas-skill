#!/usr/bin/env python3
"""Test du scanner de sécurité : fabrique un faux SaaS PLEIN DE FAILLES connues dans un dossier temporaire,
lance scripts/audit_securite.py dessus, et vérifie que chaque faille est trouvée.

Usage : python3 tests/test_audit.py
"""
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
SCANNER = HERE / 'scripts' / 'audit_securite.py'

FILES = {
    'package.json': '{"name": "saas-troue", "dependencies": {"next": "15.1.0"}}',
    '.env': 'SUPABASE_SERVICE_ROLE_KEY=valeur-factice\n',
    'src/app/api/checkout/route.ts': """export async function POST(req: Request) {
  const body = await req.json()
  const { amount } = body
  return Response.json({ pay: amount, user: body.userId })
}
""",
    'src/app/api/orders/route.ts': """export async function DELETE(req: Request) {
  const { id } = await req.json()
  await db.from('orders').delete().or(`id.eq.${id}`)
  return Response.json({ ok: true })
}
""",
    'src/app/api/webhook/pay/route.ts': """export async function POST(req: Request) {
  const e = await req.json()
  await credit(e.order, e.amount)
  return Response.json({})
}
""",
    'src/app/api/cron/clean/route.ts': """export async function GET() {
  await purge()
  return Response.json({})
}
""",
    'src/components/Admin.tsx': """'use client'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
export function Admin({ user, html }: any) {
  if (user.user_metadata.role !== 'admin') return null
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
""",
    'supabase/migrations/0001_init.sql': """create table public.orders (id uuid primary key, user_id uuid, amount int);
create table public.profiles (id uuid primary key);
alter table public.profiles enable row level security;
create policy "tout" on public.profiles for update using (true);
""",
    'Dockerfile': 'FROM node:22\nENV PAYMENT_API_KEY=valeur-factice\nCMD ["node", "server.js"]\n',
}

# Chaque faille plantée doit apparaître dans le rapport.
EXPECTED = [
    'Fichier de variables suivi par Git',
    'contournement du middleware',
    'Montant envoyé par le navigateur',
    'Identité de l’utilisateur prise dans la requête',
    'Route ou action serveur sans contrôle d’identité',
    'Filtre Supabase construit avec une variable',
    'Webhook sans vérification de signature',
    'Tâche planifiée appelable par tout le monde',
    'Clé ou client serveur dans un composant navigateur',
    'Droits lus dans user_metadata',
    'dangerouslySetInnerHTML',
    'Table sans sécurité ligne par ligne (RLS) : orders',
    'Politique RLS ouverte à tous en écriture',
    'En-têtes de sécurité absents',
    'Aucune limitation du nombre de tentatives',
    'Le conteneur tourne en root',
    'Secret écrit dans le Dockerfile',
]


def main():
    with tempfile.TemporaryDirectory(prefix='saas-troue-') as tmp:
        root = Path(tmp)
        for name, content in FILES.items():
            (root / name).parent.mkdir(parents=True, exist_ok=True)
            (root / name).write_text(content, encoding='utf-8')
        (root / 'next.config.ts').write_text('export default {}\n', encoding='utf-8')
        subprocess.run(['git', 'init', '-q'], cwd=root, check=True)
        subprocess.run(['git', 'add', '-A'], cwd=root, check=True)
        subprocess.run(['git', '-c', 'user.name=test', '-c', 'user.email=test@test', 'commit', '-qm', 'init'], cwd=root, check=True)
        report = subprocess.run([sys.executable, str(SCANNER), str(root)], capture_output=True, text=True).stdout
    missing = [e for e in EXPECTED if e not in report]
    for e in EXPECTED:
        print(('OK      ' if e not in missing else 'MANQUÉ  ') + e)
    print(f'\n{len(EXPECTED) - len(missing)}/{len(EXPECTED)} failles trouvées')
    sys.exit(1 if missing else 0)


if __name__ == '__main__':
    main()
