-- Expiration des crédits : correction du calcul (la version 0006 pouvait retirer des crédits NON expirants).
-- Exemple du défaut : un client a un lot de 1 000 crédits qui expire, un lot de 200 sans expiration, et a dépensé 700.
-- L'ancienne règle retirait min(1 000, solde 500) = 500, donc elle mangeait les 200 crédits qui n'expirent jamais.
-- Règle correcte : les dépenses consomment d'abord les lots qui expirent le plus tôt (puis ceux sans expiration) ;
-- à l'échéance d'un lot, on retire ce qu'il en reste. Rejouable.
create or replace function public.expire_credits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  batch record;
  debits integer;
  served_before integer;
  allocated integer;
  to_expire integer;
  balance integer;
  processed integer := 0;
begin
  for batch in
    select id, user_id, amount, expires_at, created_at from public.credits
     where amount > 0 and expired_at is null and expires_at is not null and expires_at < now()
     order by expires_at, created_at, id
       for update skip locked
  loop
    -- Tout ce qui a été dépensé ou retiré à la main (les lignes d'expiration ne comptent pas comme dépense).
    select coalesce(-sum(amount), 0) into debits
      from public.credits where user_id = batch.user_id and amount < 0 and source <> 'expiry';

    -- Lots servis avant celui-ci : ceux qui expirent plus tôt (les lots sans expiration passent après, la comparaison avec NULL les écarte).
    select coalesce(sum(amount), 0) into served_before
      from public.credits c
     where c.user_id = batch.user_id and c.amount > 0
       and (c.expires_at, c.created_at, c.id) < (batch.expires_at, batch.created_at, batch.id);

    allocated := least(batch.amount, greatest(debits - served_before, 0));
    to_expire := batch.amount - allocated;

    select coalesce(sum(amount), 0) into balance from public.credits where user_id = batch.user_id;
    to_expire := least(to_expire, greatest(balance, 0));

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
