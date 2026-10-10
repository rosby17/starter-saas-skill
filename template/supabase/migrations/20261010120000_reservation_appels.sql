-- 10/10 : RÉSERVATION D'APPEL avec calendrier (produit « appel-1h », 1 h d'échange).
-- Le client (qui a payé) propose jusqu'à 3 créneaux ; l'administrateur accepte l'un d'eux ou propose un autre créneau ;
-- le client accepte la contre-proposition ou repropose. Un appel par paiement.
-- Écriture uniquement par l'API (client service) après contrôle ; le client lit ses réservations, l'admin toutes. Rejouable.

create table if not exists public.call_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  status text not null default 'proposed' check (status in ('proposed', 'counter', 'confirmed', 'done', 'cancelled')),
  topic text not null default '' check (char_length(topic) <= 2000),
  slots timestamptz[] not null default '{}',      -- créneaux proposés par le client
  counter_at timestamptz,                          -- créneau proposé par l'administrateur
  scheduled_at timestamptz,                        -- créneau confirmé
  meet_url text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists call_bookings_user_idx on public.call_bookings (user_id, created_at desc);
create index if not exists call_bookings_product_idx on public.call_bookings (product_id);
create index if not exists call_bookings_status_idx on public.call_bookings (status, scheduled_at);
alter table public.call_bookings enable row level security;
drop policy if exists "Client lit ses appels" on public.call_bookings;
create policy "Client lit ses appels" on public.call_bookings for select using (auth.uid() = user_id or public.is_admin());
revoke insert, update, delete on public.call_bookings from anon, authenticated;
grant select on public.call_bookings to authenticated;
grant all on public.call_bookings to service_role;

-- Après paiement de l'appel : plus de formulaire de demande, c'est la réservation qui sert de point de départ.
update public.products set request_kind = null where slug = 'appel-1h';
