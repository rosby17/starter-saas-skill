-- Débit de crédits atomique, et index des clés étrangères restantes. Rejouable.
--
-- Avant : le serveur lisait le solde, puis écrivait le débit dans un second appel. Deux demandes envoyées en même
-- temps passaient toutes les deux le contrôle et le client consommait deux fois ses crédits (solde négatif).
-- Maintenant : un verrou par client, le contrôle et l'écriture dans la même transaction.

create or replace function public.debit_credits(p_user_id uuid, p_amount integer, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  balance bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant de débit invalide : %', p_amount;
  end if;
  -- Un seul débit à la fois par client (verrou relâché à la fin de la transaction).
  perform pg_advisory_xact_lock(hashtextextended('credits:' || p_user_id::text, 0));
  select coalesce(sum(amount), 0) into balance from public.credits where user_id = p_user_id;
  if balance < p_amount then
    return false;
  end if;
  insert into public.credits (user_id, amount, source) values (p_user_id, -p_amount, coalesce(p_reason, 'usage'));
  return true;
end;
$$;
revoke all on function public.debit_credits(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.debit_credits(uuid, integer, text) to service_role;

-- L'expiration prend le même verrou : un débit et une expiration simultanés ne peuvent plus faire passer le solde sous zéro.
create or replace function public.expire_credits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  batch record;
  balance integer;
  to_expire integer;
  processed integer := 0;
begin
  for batch in
    select id, user_id, amount from public.credits
     where amount > 0 and expired_at is null and expires_at is not null and expires_at < now()
     order by expires_at, created_at
       for update skip locked
  loop
    perform pg_advisory_xact_lock(hashtextextended('credits:' || batch.user_id::text, 0));
    select coalesce(sum(amount), 0) into balance from public.credits where user_id = batch.user_id;
    to_expire := least(batch.amount, greatest(balance, 0));
    update public.credits set expired_at = now() where id = batch.id;
    if to_expire > 0 then
      insert into public.credits (user_id, amount, source) values (batch.user_id, -to_expire, 'expiry');
      processed := processed + 1;
    end if;
  end loop;
  return processed;
end;
$$;
revoke all on function public.expire_credits() from public, anon, authenticated;
grant execute on function public.expire_credits() to service_role;

-- Clés étrangères sans index : chaque recherche par ces colonnes parcourait toute la table.
create index if not exists admin_audit_log_admin_id_idx on public.admin_audit_log(admin_id);
create index if not exists app_secrets_updated_by_idx on public.app_secrets(updated_by);
