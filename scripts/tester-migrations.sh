#!/bin/bash
# Teste les migrations d'un projet sur une vraie base Supabase JETABLE (Docker) :
#   1) chaque migration passe, 2) chaque migration passe une SECONDE fois (rejouable), 3) les tests supabase/tests/*.sql passent.
# Usage : tester-migrations.sh [dossier-du-projet]   (défaut : dossier courant). Nécessite Docker.
set -uo pipefail
PROJ="${1:-$PWD}"
IMAGE="${SUPABASE_PG_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.159}"
NAME="tmp-migtest-$$"
trap 'docker rm -f "$NAME" >/dev/null 2>&1' EXIT

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null || { echo "Impossible de lancer $IMAGE (Docker démarré ? image présente ?)"; exit 1; }
psqlc() { docker exec -i "$NAME" psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
for _ in $(seq 1 40); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 2; done

# Le CLI Supabase fournit auth.users et auth.uid() ; sur une base nue on les crée s'ils manquent.
psqlc >/dev/null <<'SQL'
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
-- Colonnes ajoutées par GoTrue sur une vraie base (lues par les migrations des comptes suspendus).
alter table auth.users add column if not exists banned_until timestamptz, add column if not exists created_at timestamptz default now(), add column if not exists last_sign_in_at timestamptz, add column if not exists phone text;
do $$ begin
  if to_regprocedure('auth.uid()') is null then
    create function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
  end if;
end $$;
SQL

fail=0
for pass in 1 2; do
  for f in $(ls "$PROJ"/supabase/migrations/*.sql | sort); do
    if out=$(psqlc < "$f" 2>&1); then echo "ok  (passage $pass) $(basename "$f")"; else echo "ECHEC (passage $pass) $(basename "$f")"; echo "$out" | grep -v NOTICE | head -6; fail=1; fi
  done
done
for t in $(ls "$PROJ"/supabase/tests/*.sql 2>/dev/null | sort); do
  if out=$(psqlc < "$t" 2>&1); then echo "test ok  $(basename "$t")"; else echo "TEST ECHEC $(basename "$t")"; echo "$out" | head -8; fail=1; fi
done
[ $fail -eq 0 ] && echo "Migrations et tests : tout passe." || echo "Des erreurs ci-dessus."
exit $fail
