-- Crédit d'une commande payée : UNE seule opération atomique, impossible à doubler.
-- Avant : la commande passait à « success » puis les crédits étaient ajoutés dans un second appel ;
-- si le second échouait, le client avait payé sans être crédité et plus rien ne réessayait.
-- Rejouable.

-- Garde-fou en base : une commande ne peut jamais être créditée deux fois.
create unique index if not exists credits_one_purchase_per_order
  on public.credits (order_id) where source = 'purchase';

create or replace function public.credit_paid_order(p_order_id uuid, p_payment_ref text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.orders%rowtype;
begin
  -- Seules les commandes en attente, échouées (paiement arrivé tard) ou expirées peuvent être créditées.
  -- JAMAIS une commande « flagged_* » (remboursement, montant insuffisant) : elle exige un examen humain.
  update public.orders
     set status = 'success',
         payment_ref = coalesce(p_payment_ref, payment_ref)
   where id = p_order_id
     and status in ('pending', 'failed', 'expired')
  returning * into claimed;

  if not found then
    return false;
  end if;

  insert into public.credits (user_id, amount, source, order_id)
  values (claimed.user_id, claimed.credits, 'purchase', claimed.id);

  return true;
end;
$$;

-- Appelable uniquement avec la clé service (routes serveur), jamais depuis le navigateur.
revoke all on function public.credit_paid_order(uuid, text) from public, anon, authenticated;
grant execute on function public.credit_paid_order(uuid, text) to service_role;
