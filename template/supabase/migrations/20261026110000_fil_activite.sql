-- Fil d'activité (Administration › Activité) : qui fait quoi sur le site, en direct, réussites ET échecs.
-- Une ligne par action (inscription, commande, demande, action payante…), avec sa source, son statut, un détail
-- long lisible à l'ouverture, et des étapes rattachées (parent_id) pour les actions longues.
-- Écrit par le serveur (recordActivity de src/lib/activity) et par les déclencheurs ci-dessous ; lu par les admins.
-- Rejouable.

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  user_id uuid references auth.users(id) on delete set null,
  -- Clé stable de l'action (ex. 'compte.inscription', 'commande', 'demande.nouvelle') : sert aux filtres.
  action text not null check (char_length(action) between 1 and 80),
  -- Phrase affichée (ex. « Commande : Formation exemple »).
  label text not null check (char_length(label) between 1 and 300),
  source text not null default 'site' check (source in ('site', 'api', 'admin', 'paiement', 'systeme')),
  status text not null default 'succeeded' check (status in ('running', 'succeeded', 'failed', 'cancelled')),
  amount numeric,
  currency text,
  -- Texte long (message du client, demande, consigne) : affiché seulement quand on ouvre la ligne.
  detail text check (detail is null or char_length(detail) <= 20000),
  error text check (error is null or char_length(error) <= 2000),
  metadata jsonb not null default '{}'::jsonb,
  -- Étape d'une action longue : rangée sous sa ligne mère, dépliable.
  parent_id uuid references public.activity_events(id) on delete cascade,
  -- Objet concerné (ex. 'orders' + identifiant) : relie la ligne à sa fiche et évite les doublons.
  ref_table text,
  ref_id text
);

create index if not exists activity_events_created_idx on public.activity_events (created_at desc);
create index if not exists activity_events_user_idx on public.activity_events (user_id);
create index if not exists activity_events_parent_idx on public.activity_events (parent_id);
create index if not exists activity_events_status_idx on public.activity_events (status, created_at desc);
create index if not exists activity_events_ref_idx on public.activity_events (ref_table, ref_id);

alter table public.activity_events enable row level security;
-- Lecture réservée aux administrateurs ; écriture par le serveur (clé service) et les déclencheurs seulement.
revoke all on public.activity_events from anon;
revoke insert, update, delete on public.activity_events from authenticated;
drop policy if exists "Admins lisent le fil d'activité" on public.activity_events;
create policy "Admins lisent le fil d'activité" on public.activity_events for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Inscriptions : chaque nouveau profil (formulaire, Google, compte créé au paiement).
-- Un déclencheur ne doit JAMAIS faire échouer l'inscription : toute erreur est avalée.
-- ---------------------------------------------------------------------------
create or replace function public.activity_on_profile_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  begin
    insert into public.activity_events (user_id, action, label, source, ref_table, ref_id, finished_at)
    values (new.id, 'compte.inscription', 'Nouvelle inscription', 'site', 'profiles', new.id::text, now());
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists activity_profile_created on public.profiles;
create trigger activity_profile_created after insert on public.profiles
  for each row execute function public.activity_on_profile_created();

-- ---------------------------------------------------------------------------
-- Commandes : une ligne « en cours » à la création, terminée (payée, échouée, annulée) au changement de statut.
-- Lue depuis la base : la brique de paiement verrouillée (paiement.lock.json) n'est pas modifiée.
-- ---------------------------------------------------------------------------
create or replace function public.activity_on_order()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_title text;
  v_status text;
  v_amount numeric;
  v_currency text;
  v_label text;
begin
  begin
    select title into v_title from public.products where id = new.product_id;
    v_title := coalesce(v_title, new.plan_name, 'Commande');
    v_status := case
      when new.status = 'success' then 'succeeded'
      when new.status = 'pending' then 'running'
      when new.status = 'cancelled' then 'cancelled'
      else 'failed' end;
    if coalesce(new.paid_amount_fcfa, new.amount_fcfa) is not null then
      v_amount := coalesce(new.paid_amount_fcfa, new.amount_fcfa);
      v_currency := 'XOF';
    else
      v_amount := new.amount_local;
      v_currency := new.currency;
    end if;
    v_label := case v_status
      when 'succeeded' then 'Commande payée : '
      when 'running' then 'Commande en attente de paiement : '
      when 'cancelled' then 'Commande annulée : '
      else 'Paiement échoué : ' end || v_title;

    if tg_op = 'INSERT' then
      insert into public.activity_events (created_at, finished_at, user_id, action, label, source, status, amount, currency, error, metadata, ref_table, ref_id)
      values (new.created_at, case when v_status = 'running' then null else now() end, new.user_id, 'commande', v_label, 'paiement', v_status,
        v_amount, v_currency, case when v_status = 'failed' then new.status end,
        jsonb_build_object('moyen', new.payment_method, 'test', coalesce(new.is_test, false)), 'orders', new.id::text);
    elsif new.status is distinct from old.status then
      update public.activity_events
         set status = v_status, label = v_label, amount = v_amount, currency = v_currency,
             finished_at = case when v_status = 'running' then null else now() end,
             error = case when v_status = 'failed' then new.status end,
             metadata = metadata || jsonb_build_object('moyen', new.payment_method, 'test', coalesce(new.is_test, false))
       where ref_table = 'orders' and ref_id = new.id::text and parent_id is null;
      if not found then
        insert into public.activity_events (created_at, finished_at, user_id, action, label, source, status, amount, currency, error, metadata, ref_table, ref_id)
        values (new.created_at, case when v_status = 'running' then null else now() end, new.user_id, 'commande', v_label, 'paiement', v_status,
          v_amount, v_currency, case when v_status = 'failed' then new.status end,
          jsonb_build_object('moyen', new.payment_method, 'test', coalesce(new.is_test, false)), 'orders', new.id::text);
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists activity_order_changed on public.orders;
create trigger activity_order_changed after insert or update of status on public.orders
  for each row execute function public.activity_on_order();

revoke execute on function public.activity_on_profile_created() from anon, authenticated;
revoke execute on function public.activity_on_order() from anon, authenticated;
