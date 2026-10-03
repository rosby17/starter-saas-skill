#!/bin/bash
# Crée un nouveau SaaS à partir du modèle du skill.
# Usage : creer-saas.sh <slug> "<Nom affiché>" [dossier-parent]
#   slug : minuscules et tirets (ex. mon-saas). Dossier créé : <dossier-parent>/<slug> (défaut : dossier courant).
set -euo pipefail
SLUG="${1:?Usage: creer-saas.sh <slug> \"<Nom>\" [dossier-parent]}"
NAME="${2:?Donne le nom affiché du SaaS}"
PARENT="${3:-$PWD}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$PARENT/$SLUG"

[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "Le slug doit être en minuscules et tirets (ex. mon-saas)."; exit 1; }
[ -e "$DEST" ] && { echo "Le dossier $DEST existe déjà : rien n'est écrasé."; exit 1; }

mkdir -p "$DEST"
cp -R "$HERE/template/." "$DEST/"

# Remplace les marques de la copie (nom affiché, domaine d'exemple, nom du paquet)
export NAME SLUG
while IFS= read -r -d '' f; do
  python3 - "$f" <<'PY'
import os, sys
p = sys.argv[1]
try:
    s = open(p, encoding='utf-8').read()
except Exception:
    sys.exit(0)
n = s.replace('{{APP_NAME}}', os.environ['NAME']).replace('yoursaas.app', os.environ['SLUG'] + '.com')
if n != s:
    open(p, 'w', encoding='utf-8').write(n)
PY
done < <(find "$DEST" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.md' -o -name '*.json' -o -name '*.html' -o -name '*.example' -o -name '*.sql' \) -print0)

python3 - "$DEST/package.json" "$SLUG" <<'PY'
import json, sys
p, slug = sys.argv[1], sys.argv[2]
d = json.load(open(p)); d['name'] = slug
json.dump(d, open(p, 'w'), indent=2, ensure_ascii=False); open(p, 'a').write('\n')
PY

[ -f "$DEST/.env.example" ] && cp "$DEST/.env.example" "$DEST/.env.local"
# Jeton à usage unique de l'assistant /setup (local uniquement, jamais dans Git).
SETUP_TOKEN="$(openssl rand -hex 24 2>/dev/null || python3 -c 'import secrets;print(secrets.token_hex(24))')"
printf '\n# Assistant de démarrage (/setup)\nSETUP_TOKEN=%s\n' "$SETUP_TOKEN" >> "$DEST/.env.local"
chmod 600 "$DEST/.env.local"
cd "$DEST"

# Base de données locale : Supabase open source dans Docker (aucun compte). L'assistant /setup la démarre.
# Ports propres à ce projet, pour que plusieurs SaaS tournent sur le même ordinateur sans conflit.
if command -v supabase >/dev/null 2>&1; then SB=(supabase); else SB=(npx -y supabase); fi
"${SB[@]}" init --with-vscode-settings=false --with-intellij-settings=false </dev/null >/dev/null 2>&1 || true
if [ -f supabase/config.toml ]; then
  python3 - "$SLUG" <<'PY'
import hashlib, re, socket, sys
slug = sys.argv[1]
def free(port):
    with socket.socket() as s:
        try: s.bind(('127.0.0.1', port)); return True
        except OSError: return False
start = int(hashlib.sha1(slug.encode()).hexdigest(), 16) % 90
for k in range(90):
    base = 55000 + ((start + k) % 90) * 100
    if all(free(base + i) for i in range(10)): break
p = 'supabase/config.toml'; s = open(p).read()
s = re.sub(r'^project_id = .*$', f'project_id = "{slug}"', s, count=1, flags=re.M)
def section(name, key, value):
    global s
    m = re.search(rf'^\[{re.escape(name)}\]\n(.*?)(?=^\[)', s, flags=re.M | re.S)
    if not m: return
    body = re.sub(rf'^#?\s*{key} = .*$', f'{key} = {value}', m.group(1), count=1, flags=re.M)
    s = s[:m.start(1)] + body + s[m.end(1):]
section('api', 'port', base + 1)
section('db', 'port', base + 2)
section('db', 'shadow_port', base)
section('db.pooler', 'port', base + 9)
section('studio', 'port', base + 3)
section('local_smtp', 'port', base + 4)
section('analytics', 'port', base + 7)
section('edge_runtime', 'inspector_port', base + 8)
section('auth', 'additional_redirect_urls', '["http://localhost:3000", "http://127.0.0.1:3000"]')
# Inutiles en local, et lourds à télécharger : statistiques (logflare, vector) et fonctions edge.
section('analytics', 'enabled', 'false')
section('edge_runtime', 'enabled', 'false')
open(p, 'w').write(s)
print(f'Base locale : ports {base}-{base + 9} (API http://127.0.0.1:{base + 1}, tableau de bord http://127.0.0.1:{base + 3})')
PY
fi

git init -q && git add -A && git commit -q -m "Départ : $NAME (skill starter-saas)" || true
echo "Projet créé : $DEST"
echo "Étapes suivantes : npm install, npm run dev, puis ouvrir l'assistant (il démarre la base dans Docker) :"
echo "SETUP_URL=http://localhost:3000/setup?token=$SETUP_TOKEN"
