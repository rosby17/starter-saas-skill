-- 10/10 : PRÉCOMMANDE des formations pas encore prêtes.
--  · Le client réserve sa place en payant 10 % du prix (commande « deposit ») : il entre sur la liste d'attente,
--    SANS accès au contenu.
--  · Quand la formation sort (preorder = false), il termine en payant 60 % du prix (commande « balance ») au lieu
--    de 100 % : l'accès lui est donné à ce moment-là.
-- Rejouable.

alter table public.products add column if not exists preorder boolean not null default false;
alter table public.orders add column if not exists purchase_kind text not null default 'full';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orders_purchase_kind_check') then
    alter table public.orders add constraint orders_purchase_kind_check check (purchase_kind in ('full', 'deposit', 'balance'));
  end if;
end $$;

create table if not exists public.preorders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  deposit_order_id uuid references public.orders(id) on delete set null,
  balance_order_id uuid references public.orders(id) on delete set null,
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists preorders_one_active on public.preorders (user_id, product_id) where status <> 'cancelled';
create index if not exists preorders_product_idx on public.preorders (product_id);
create index if not exists preorders_deposit_idx on public.preorders (deposit_order_id);
create index if not exists preorders_balance_idx on public.preorders (balance_order_id);
alter table public.preorders enable row level security;
drop policy if exists "Clients lisent leurs réservations" on public.preorders;
create policy "Clients lisent leurs réservations" on public.preorders for select using (auth.uid() = user_id or public.is_admin());
revoke insert, update, delete on public.preorders from anon, authenticated;
grant select on public.preorders to authenticated;
grant all on public.preorders to service_role;

-- Paiement confirmé : réservation (liste d'attente), solde (accès + réservation terminée) ou achat normal (accès).
create or replace function public.credit_paid_order(p_order_id uuid, p_payment_ref text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.orders%rowtype;
begin
  update public.orders
     set status = 'success',
         payment_ref = coalesce(p_payment_ref, payment_ref)
   where id = p_order_id
     and status in ('pending', 'failed', 'expired')
  returning * into claimed;

  if not found then
    return false;
  end if;

  if claimed.credits > 0 then
    insert into public.credits (user_id, amount, source, order_id, expires_at)
    values (
      claimed.user_id, claimed.credits, 'purchase', claimed.id,
      case when claimed.validity_days is null then null else now() + make_interval(days => claimed.validity_days) end
    );
  end if;

  if claimed.product_id is not null then
    if claimed.purchase_kind = 'deposit' then
      insert into public.preorders (user_id, product_id, deposit_order_id)
      values (claimed.user_id, claimed.product_id, claimed.id)
      on conflict do nothing;
    else
      perform public.grant_product_access(claimed.user_id, claimed.product_id, 'purchase', claimed.id, null);
      if claimed.purchase_kind = 'balance' then
        update public.preorders set status = 'completed', balance_order_id = claimed.id, completed_at = now()
         where user_id = claimed.user_id and product_id = claimed.product_id and status = 'reserved';
      end if;
    end if;
  end if;

  return true;
end;
$$;
revoke all on function public.credit_paid_order(uuid, text) from public, anon, authenticated;
grant execute on function public.credit_paid_order(uuid, text) to service_role;
