#!/bin/bash
# Installe (ou réinstalle) la PAGE DE PAIEMENT VERROUILLÉE du kit dans un projet Next.js existant :
# les fichiers de la brique, son verrou (paiement.lock.json + scripts/verrou-paiement.mjs) et les scripts npm.
# Usage : installer-paiement.sh <dossier-du-projet>
# Ensuite : adapter le projet AUTOUR de la brique (voir references/paiement-verrouille.md), jamais la brique.
set -euo pipefail
DEST="$(cd "${1:?Usage: installer-paiement.sh <dossier-du-projet>}" && pwd)"
KIT="$(cd "$(dirname "$0")/../template" && pwd)"
[ -f "$DEST/package.json" ] || { echo "Pas de package.json dans $DEST : ce n'est pas un projet Node."; exit 1; }
[ "$DEST" = "$KIT" ] && { echo "C'est le modèle du kit lui-même : rien à installer."; exit 1; }

# Le kit doit être intègre avant de copier quoi que ce soit.
node "$KIT/scripts/verrou-paiement.mjs" >/dev/null || { echo "La brique du kit ne correspond pas à son verrou : la re-signer dans le kit d'abord."; exit 1; }

FILES=$(python3 -c "import json;print('\n'.join(json.load(open('$KIT/paiement.lock.json'))['files']))")
CHANGED=0
while IFS= read -r f; do
  if [ -f "$DEST/$f" ] && ! cmp -s "$KIT/$f" "$DEST/$f"; then
    mkdir -p "$DEST/.paiement-avant-kit/$(dirname "$f")"
    cp "$DEST/$f" "$DEST/.paiement-avant-kit/$f"   # ancienne version gardée pour comparer
    CHANGED=$((CHANGED + 1))
  fi
  mkdir -p "$DEST/$(dirname "$f")"
  cp "$KIT/$f" "$DEST/$f"
done <<< "$FILES"
mkdir -p "$DEST/scripts"
cp "$KIT/paiement.lock.json" "$DEST/paiement.lock.json"
cp "$KIT/scripts/verrou-paiement.mjs" "$DEST/scripts/verrou-paiement.mjs"

# Scripts npm : le verrou passe avant le lint et avant chaque build.
python3 - "$DEST/package.json" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p))
s = d.setdefault('scripts', {})
lint = s.get('lint', 'eslint')
if 'verrou-paiement' not in lint:
    s['lint'] = 'node scripts/verrou-paiement.mjs && ' + lint
pre = s.get('prebuild', '')
if 'verrou-paiement' not in pre:
    s['prebuild'] = 'node scripts/verrou-paiement.mjs' + (' && ' + pre if pre else '')
s['verrou-paiement'] = 'node scripts/verrou-paiement.mjs'
deps = d.setdefault('dependencies', {})
for name, version in (('qrcode', '^1.5.4'), ('zod', deps.get('zod', '^3.23.8'))):
    deps.setdefault(name, version)
d.setdefault('devDependencies', {}).setdefault('@types/qrcode', '^1.5.6')
json.dump(d, open(p, 'w'), indent=2, ensure_ascii=False)
open(p, 'a').write('\n')
PY

N=$(echo "$FILES" | wc -l | tr -d ' ')
echo "Brique de paiement installée : $N fichiers + verrou ($CHANGED ancien(s) fichier(s) gardé(s) dans .paiement-avant-kit/)."
echo "À faire maintenant (references/paiement-verrouille.md) :"
echo "  1. npm install"
echo "  2. npx tsc --noEmit : chaque erreur montre un module, une table ou un réglage à fournir AUTOUR de la brique"
echo "     (lib/catalog, lib/customers, lib/invoices, lib/email, config/site.ts › whatsapp / payments / company, migrations du modèle)."
echo "  3. Remplacer les anciens boutons d'achat par openCheckout('<slug>') et ajouter <CheckoutProvider> au layout racine."
echo "  4. npm run lint && npm run build, puis un achat réel de bout en bout en local."
