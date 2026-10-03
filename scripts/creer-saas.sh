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
cd "$DEST"
git init -q && git add -A && git commit -q -m "Départ : $NAME (skill starter-saas)" || true
echo "Projet créé : $DEST"
echo "Étapes suivantes : remplir .env.local, créer le projet Supabase, 'supabase db push', 'npm install', 'npm run dev'."
