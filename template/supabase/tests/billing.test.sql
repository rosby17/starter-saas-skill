-- Tests de la facturation (crédit atomique, expiration, droits). Lancés par scripts/tester-migrations.sh sur une base jetable.
-- Chaque `assert` qui échoue arrête le test avec un message clair.
do $$
declare
  alice uuid := '00000000-0000-0000-0000-0000000000a1';
  admin_id uuid := '00000000-0000-0000-0000-0000000000b2';
  n integer;
begin
  delete from public.credits where user_id in (alice, admin_id);
  delete from public.orders where user_id in (alice, admin_id);
  insert into auth.users (id, email) values (alice, 'a@test'), (admin_id, 'b@test') on conflict do nothing;
  insert into public.profiles (id, first_name, is_admin) values (alice, 'Alice', false), (admin_id, 'Admin', true)
    on conflict (id) do update set is_admin = excluded.is_admin;

  -- Crédit atomique : une commande en attente est créditée UNE fois.
  insert into public.orders (id, user_id, plan_name, credits, amount_local, currency, status, validity_days) values
    ('c1000000-0000-0000-0000-000000000001', alice, 'Pro', 1000, 5000, 'XOF', 'pending', 1),
    ('c1000000-0000-0000-0000-000000000002', alice, 'Sans expiration', 200, 1000, 'XOF', 'pending', null),
    ('c1000000-0000-0000-0000-000000000003', alice, 'Sous-payée', 500, 5000, 'XOF', 'flagged_underpaid', null),
    ('c1000000-0000-0000-0000-000000000004', alice, 'Payée en retard', 50, 500, 'XOF', 'failed', null);
  assert public.credit_paid_order('c1000000-0000-0000-0000-000000000001') = true, 'premier crédit refusé';
  assert public.credit_paid_order('c1000000-0000-0000-0000-000000000001') = false, 'double crédit accepté';
  assert public.credit_paid_order('c1000000-0000-0000-0000-000000000002') = true, 'commande sans expiration refusée';
  assert public.credit_paid_order('c1000000-0000-0000-0000-000000000003') = false, 'commande flagged_underpaid créditée';
  assert public.credit_paid_order('c1000000-0000-0000-0000-000000000004') = true, 'paiement arrivé après échec refusé';
  select count(*) into n from public.credits where user_id = alice and source = 'purchase';
  assert n = 3, 'nombre de lots achetés attendu : 3, obtenu ' || n;

  -- Garde-fou en base : un second achat pour la même commande est impossible.
  begin
    insert into public.credits (user_id, amount, source, order_id) values (alice, 1000, 'purchase', 'c1000000-0000-0000-0000-000000000001');
    assert false, 'la base a accepté un double crédit pour une même commande';
  exception when unique_violation then null;
  end;

  -- Expiration : lot 1000 (expire), lots sans expiration 200 + 50, dépensé 700 → il reste 300 du lot à expirer.
  insert into public.credits (user_id, amount, source) values (alice, -700, 'usage');
  update public.credits set expires_at = now() - interval '1 day' where order_id = 'c1000000-0000-0000-0000-000000000001';
  assert public.expire_credits() = 1, 'un lot devait expirer';
  select sum(amount) into n from public.credits where user_id = alice;
  assert n = 250, 'solde attendu 250 (les crédits sans expiration intacts), obtenu ' || n;
  assert public.expire_credits() = 0, 'le second passage ne doit rien refaire';
end $$;

-- Droits : un utilisateur ne voit que ses lignes, ne devient pas admin, ne peut pas appeler le crédit.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$
declare n integer;
begin
  select count(*) into n from public.profiles;
  assert n = 1, 'un utilisateur voit plusieurs profils : ' || n;
  update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000a1';
  assert (select is_admin from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') = false, 'un utilisateur a pu se donner les droits admin';
  begin
    perform public.credit_paid_order('c1000000-0000-0000-0000-000000000003');
    assert false, 'un utilisateur a pu appeler credit_paid_order';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
do $$
begin
  assert (select count(*) from public.profiles) >= 2, 'un administrateur doit voir tous les profils';
end $$;
reset role;
