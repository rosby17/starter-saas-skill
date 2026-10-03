#!/usr/bin/env bash
# Nettoyage hebdomadaire des déchets techniques du serveur (Docker + journaux).
# Ne touche JAMAIS aux volumes (bases de données, stockage) ni aux conteneurs.
#   - cache de build Docker de plus de 48 h (les builds récents restent rapides)
#   - images Docker orphelines (« dangling », sans nom ni conteneur)
#   - journaux systemd de plus de 14 jours
# Installation : voir ops/nettoyage-serveur.cron. Par défaut : simulation.
set -euo pipefail

mode="${1:---dry-run}"
cache_retention="${NETTOYAGE_CACHE_HEURES:-48h}"
journal_retention="${NETTOYAGE_JOURNAL_JOURS:-14d}"
lock_file="/run/lock/nettoyage-serveur.lock"

if [[ "${mode}" != "--dry-run" && "${mode}" != "--execute" ]]; then
  echo "Usage: $0 [--dry-run|--execute]" >&2
  exit 64
fi

exec 9>"${lock_file}"
if ! flock -n 9; then
  echo "Un nettoyage est déjà en cours."
  exit 0
fi

# Un build en cours (Coolify) utilise le cache : on ne nettoie pas pendant.
if pgrep -f 'buildx build|npm run build' >/dev/null; then
  echo "$(date --iso-8601=seconds) build en cours, nettoyage reporté."
  exit 0
fi

echo "$(date --iso-8601=seconds) mode=${mode} disque_avant=$(df --output=pcent / | tail -1 | tr -d ' ')"
docker system df

if [[ "${mode}" == "--dry-run" ]]; then
  echo "Simulation : rien n'est supprimé."
  exit 0
fi

docker builder prune --force --filter "until=${cache_retention}"
docker image prune --force
journalctl --vacuum-time="${journal_retention}"

echo "$(date --iso-8601=seconds) disque_apres=$(df --output=pcent / | tail -1 | tr -d ' ')"
