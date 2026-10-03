#!/usr/bin/env python3
"""Test des scanners de rentabilité et de robustesse, et du calcul de rentabilité.

1. Fabrique un faux SaaS plein de défauts connus (pertes d'argent, fragilités) et vérifie que chacun est trouvé.
2. Fabrique la version CORRIGÉE du même SaaS et vérifie qu'aucun de ces signaux ne sort (pas de fausse alerte).
3. Vérifie le calcul de marge sur des chiffres dont le résultat est connu.

Usage : python3 tests/test_rentabilite_robustesse.py
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
RENTA = HERE / 'scripts' / 'audit_rentabilite.py'
ROBU = HERE / 'scripts' / 'audit_robustesse.py'
CALC = HERE / 'scripts' / 'calcul_rentabilite.py'

FLAWED = {
    'package.json': '{"name": "saas-fragile", "dependencies": {"next": "latest", "openai": "^5.0.0"}}',
    'next.config.ts': 'export default { typescript: { ignoreBuildErrors: true } }\n',
    'tsconfig.json': '{"compilerOptions": {"strict": false}}',
    'Dockerfile': 'FROM node:22\nUSER node\nCMD ["node", "server.js"]\n',
    # IA ouverte à tous, sans compte ni limite, sans longueur maximale, modèle haut de gamme
    'src/app/api/ask/route.ts': """import OpenAI from 'openai'
const client = new OpenAI()
export async function POST(req: Request) {
  const { question } = await req.json()
  const r = await client.chat.completions.create({ model: 'gpt-4o', messages: [{ role: 'user', content: question }] })
  return Response.json({ answer: r.choices[0].message.content })
}
""",
    # IA derrière un compte, via une fonction utilitaire, mais sans aucun décompte
    'src/lib/ai.ts': """export async function summarize(text: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(30_000), body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 500, messages: [{ role: 'user', content: text }] }) })
  return res.json()
}
""",
    'src/app/api/summary/route.ts': """import { summarize } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('non', { status: 401 })
  const { text } = await req.json()
  await supabase.from('summaries').insert({ user_id: user.id, text })
  return Response.json(await summarize(text))
}
""",
    # Crédits : lecture puis écriture séparées
    'src/lib/credits.ts': """export async function spend(db: any, userId: string, n: number) {
  const balance = await getCreditsBalance(db, userId)
  if (balance < n) throw new Error('solde')
  await db.from('credits').insert({ user_id: userId, amount: -n, source: 'usage' })
}
""",
    # Prix provisoires, grande offre plus chère à l'unité, gratuit trop généreux
    'src/lib/pricing.ts': """// TODO: replace placeholder prices
export const PLANS = [
  { id: 'free', amountLocal: 0, credits: 400 },
  { id: 'pro', amountLocal: 5000, credits: 1000 },
  { id: 'max', amountLocal: 20000, credits: 2000 },
]
""",
    # Paiement sans rattrapage, appel de passerelle sans délai maximal, liste sans limite, boucle de requêtes
    'src/app/api/checkout/route.ts': """export async function POST() {
  const r = await fetch('https://api.passerelle.example/pay', { method: 'POST' })
  return Response.json(await r.json())
}
""",
    'src/app/admin/orders/page.tsx': """import { createClient } from '@/lib/supabase/server'
export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('orders').select('*').order('created_at')
  for (const o of data || []) { await supabase.from('profiles').select('email').eq('id', o.user_id) }
  return null
}
""",
    'src/app/api/cron/rappels/route.ts': """export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new Response('non', { status: 401 })
  return Response.json({ ok: true })
}
""",
    'supabase/migrations/0001_init.sql': """create table public.orders (
  id uuid primary key,
  user_id uuid references auth.users(id),
  amount int
);
""",
    'supabase/migrations/0001_doublon.sql': 'drop table public.vieux;\n',
}

EXPECTED_RENTA = [
    'Fonction payante ouverte à tous',
    'Fonction payante sans limite par client',
    'Réponse d’IA sans longueur maximale',
    'Modèle d’IA haut de gamme : gpt-4o',
    'Crédits débités en deux temps',
    'Prix provisoires encore en place',
    'L’offre « max » coûte plus cher à l’unité que « pro »',
    'Offre gratuite proche de la première offre payante',
    'Aucun rattrapage des paiements en attente',
    'Aucune mesure du parcours des visiteurs',
    'Aucun e-mail envoyé par l’application',
]
EXPECTED_ROBU = [
    'Appel extérieur sans délai maximal',
    'Écriture en base sans contrôle d’erreur (insert)',
    'Liste chargée sans limite (orders)',
    'Une requête à la base par élément d’une boucle',
    'Clé étrangère sans index : orders.user_id',
    'Migrations avec le même numéro',
    'Migration destructive (drop table)',
    'Pas de page d’erreur',
    'Pas de page d’erreur globale',
    'Aucune adresse de contrôle de santé',
    'Le conteneur n’a pas de contrôle de santé',
    'Les erreurs des clients ne sont remontées nulle part',
    'Variables d’environnement non vérifiées au démarrage',
    'Le build ignore les erreurs',
    'TypeScript en mode non strict',
    'Dépendance principale en version « latest »',
    'Tâche planifiée sans verrou',
    'Aucune sauvegarde de la base visible',
]

# Le même SaaS, corrigé : aucun des signaux ci-dessus ne doit sortir.
FIXED = {
    'package.json': '{"name": "saas-solide", "dependencies": {"next": "^15.5.0", "openai": "^5.0.0"}}',
    'next.config.ts': 'export default {}\n',
    'tsconfig.json': '{"compilerOptions": {"strict": true}}',
    'Dockerfile': 'FROM node:22\nUSER node\nHEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1\nCMD ["node", "server.js"]\n',
    'src/lib/env.ts': "const REQUIRED_SERVER_ENV = ['A']\nexport function assertServerEnv() { if (REQUIRED_SERVER_ENV.some((k) => !process.env[k])) throw new Error('x') }\n",
    'src/instrumentation.ts': "export function onRequestError(e: unknown) { console.error('[ERREUR CLIENT]', e) }\n",
    'src/app/error.tsx': "'use client'\nexport default function E() { return null }\n",
    'src/app/global-error.tsx': "'use client'\nexport default function G() { return null }\n",
    'src/app/api/health/route.ts': 'export function GET() { return Response.json({ ok: true }) }\n',
    'src/app/layout.tsx': "import Script from 'next/script'\nexport default function L({ children }: any) { return <html><body>{children}<Script src='https://umami.example/script.js' /></body></html> }\n",
    'src/lib/email.ts': "export async function send() { await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', signal: AbortSignal.timeout(15_000) }) }\n",
    'src/lib/relance.ts': '// relance des paiements en attente après 1 h\nexport const RELANCE = 1\n',
    'src/app/api/ask/route.ts': """import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { debitCredits } from '@/lib/credits'
const client = new OpenAI()
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('non', { status: 401 })
  await debitCredits(supabase, user.id, 1, 'ask')
  const { question } = await req.json()
  const r = await client.chat.completions.create({ model: 'gpt-4o-mini', max_tokens: 400, messages: [{ role: 'user', content: question }] })
  return Response.json({ answer: r.choices[0].message.content })
}
""",
    'src/lib/credits.ts': """export async function debitCredits(db: any, userId: string, n: number, reason: string) {
  const { data, error } = await db.rpc('debit_credits', { p_user_id: userId, p_amount: n, p_reason: reason })
  if (error || !data) throw new Error('solde')
}
""",
    'src/lib/pricing.ts': """export const PLANS = [
  { id: 'free', amountLocal: 0, credits: 50 },
  { id: 'pro', amountLocal: 5000, credits: 1000 },
  { id: 'max', amountLocal: 20000, credits: 5000 },
]
""",
    'src/app/api/checkout/route.ts': """export async function POST() {
  const r = await fetch('https://api.passerelle.example/pay', { method: 'POST', signal: AbortSignal.timeout(15_000) })
  return Response.json(await r.json())
}
""",
    'src/app/api/payment/reconcile-pending/route.ts': 'export async function POST() { return Response.json({}) }\n',
    'src/app/admin/orders/page.tsx': """import { createClient } from '@/lib/supabase/server'
export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('orders').select('*, profiles(email)').order('created_at').range(0, 49)
  return null
}
""",
    'src/app/api/cron/rappels/route.ts': """import { acquireCronLock } from '@/lib/cron-lock'
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new Response('non', { status: 401 })
  if (!(await acquireCronLock('rappels'))) return Response.json({ skipped: true })
  return Response.json({ ok: true })
}
""",
    'supabase/migrations/0001_init.sql': """create table public.orders (
  id uuid primary key,
  user_id uuid references auth.users(id),
  amount int
);
create index if not exists orders_user_id_idx on public.orders(user_id);
""",
    'tests/parcours.test.ts': 'test("parcours", () => {})\n',
    '.github/workflows/ci.yml': 'on: push\n',
    'docs/sauvegardes.md': 'Sauvegarde quotidienne de la base (Coolify Backups vers S3).\n',
}


def build(files):
    tmp = tempfile.TemporaryDirectory(prefix='saas-test-')
    root = Path(tmp.name)
    for name, content in files.items():
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text(content, encoding='utf-8')
    subprocess.run(['git', 'init', '-q'], cwd=root, check=True)
    return tmp, root


def scan(script, root):
    return subprocess.run([sys.executable, str(script), str(root)], capture_output=True, text=True).stdout


def check(label, report, expected, present=True):
    ok = 0
    for e in expected:
        found = e in report
        good = found if present else not found
        ok += good
        print(('OK      ' if good else ('MANQUÉ  ' if present else 'FAUSSE ALERTE  ')) + e)
    print(f'{label} : {ok}/{len(expected)}\n')
    return ok == len(expected)


def test_calcul():
    data = {
        'devise': 'FCFA', 'marge_visee_pct': 70,
        'couts_fixes_mensuels': {'serveur': 10000},
        'frais_paiement': {'pourcentage': 0, 'fixe_par_paiement': 0},
        # 1 000 unités à 2 FCFA = 2 000 de coût si tout est consommé, 1 000 pour un client moyen (50 %).
        'offres': [{'nom': 'Pro', 'prix': 5000, 'unites': 1000, 'usage_moyen_pct': 50, 'cout_par_unite': 2, 'cout_fixe_par_client': 0},
                   {'nom': 'Perte', 'prix': 1000, 'unites': 1000, 'usage_moyen_pct': 50, 'cout_par_unite': 2, 'cout_fixe_par_client': 0}],
        'clients_payants_actuels': {'Pro': 3},
    }
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / 'chiffres.json'
        f.write_text(json.dumps(data), encoding='utf-8')
        out = subprocess.run([sys.executable, str(CALC), str(f)], capture_output=True, text=True).stdout
    checks = [
        ('| Pro | 5 000 FCFA | 0 FCFA | 1 000 FCFA | 4 000 FCFA | 80 % | 3 000 FCFA | 6 667 FCFA |', 'marge de l’offre Pro'),
        ('Il faut **3 clients payants**', 'point mort (10 000 / 4 000 = 2,5 → 3)'),
        ('bénéfice de 2 000 FCFA par mois', 'résultat actuel (3 × 4 000 − 10 000)'),
        ('**CRITIQUE** : « Perte » perd 1 000 FCFA', 'offre qui perd de l’argent au maximum'),
    ]
    ok = 0
    for needle, label in checks:
        good = needle in out
        ok += good
        print(('OK      ' if good else 'FAUX    ') + label)
    print(f'Calcul : {ok}/{len(checks)}\n')
    return ok == len(checks)


def main():
    tmp, root = build(FLAWED)
    with tmp:
        renta, robu = scan(RENTA, root), scan(ROBU, root)
    tmp2, root2 = build(FIXED)
    with tmp2:
        renta2, robu2 = scan(RENTA, root2), scan(ROBU, root2)
    results = [
        check('Rentabilité, défauts trouvés', renta, EXPECTED_RENTA),
        check('Robustesse, défauts trouvés', robu, EXPECTED_ROBU),
        check('Rentabilité, SaaS corrigé sans fausse alerte', renta2, [e.split(' : ')[0] for e in EXPECTED_RENTA], present=False),
        check('Robustesse, SaaS corrigé sans fausse alerte', robu2, [e.split(' (')[0].split(' : ')[0] for e in EXPECTED_ROBU], present=False),
        test_calcul(),
    ]
    sys.exit(0 if all(results) else 1)


if __name__ == '__main__':
    main()
