-- Boutique : catalogue (rayons), leçons, fichiers à télécharger, accès des clients,
-- progression, demandes (accompagnements, services sur devis), coordonnées des clients.
-- Rejouable : on peut l'appliquer plusieurs fois sans erreur.

-- ---------------------------------------------------------------------------
-- Fonction commune : met à jour updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profils : coordonnées du client (nom, e-mail, WhatsApp, pays)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
create index if not exists profiles_email_idx on public.profiles (lower(email));

update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Création du profil à l'inscription (ou à l'achat) : reprend nom, téléphone et pays fournis.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, full_name, phone, country)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', split_part(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ', 1)),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'country'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Un client ne peut ni se donner les droits admin ni changer l'e-mail enregistré de son profil.
create or replace function public.protect_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if new.is_admin is distinct from old.is_admin then
      new.is_admin := old.is_admin;
    end if;
    if new.email is distinct from old.email then
      new.email := old.email;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Produits (catalogue public)
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category text not null check (category in ('formation', 'accompagnement', 'logiciel', 'service')),
  title text not null,
  subtitle text,
  description text,
  features text[] not null default '{}',
  price_fcfa integer check (price_fcfa is null or price_fcfa >= 0),       -- null = sur demande / sur devis
  compare_at_fcfa integer check (compare_at_fcfa is null or compare_at_fcfa >= 0), -- prix barré affiché
  promo_price_fcfa integer check (promo_price_fcfa is null or promo_price_fcfa >= 0),
  promo_ends_at timestamptz,
  image text,
  sales_url text,       -- page de vente dédiée (ex. /formations/mon-cours), sinon /boutique/<slug>
  external_url text,    -- logiciel vendu sur son propre site (ex. un logiciel qui a son site)
  includes text[] not null default '{}',  -- autres produits (slugs) offerts avec celui-ci (ex. le coaching inclut le replay)
  request_kind text check (request_kind is null or request_kind in ('coaching', 'accompagnement', 'projet', 'design', 'audit', 'autre')),
  published boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_published_idx on public.products (published, category, position);
alter table public.products enable row level security;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Accès des clients : un accès par client et par produit, accordé par un paiement, l'admin ou un import.
-- Écrit UNIQUEMENT côté serveur (clé service) : aucune politique d'écriture pour les clients.
-- ---------------------------------------------------------------------------
create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  source text not null default 'purchase' check (source in ('purchase', 'admin', 'import')),
  granted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index if not exists entitlements_product_idx on public.entitlements (product_id);
create index if not exists entitlements_order_idx on public.entitlements (order_id);
create index if not exists entitlements_granted_by_idx on public.entitlements (granted_by);
alter table public.entitlements enable row level security;

drop trigger if exists entitlements_updated_at on public.entitlements;
create trigger entitlements_updated_at before update on public.entitlements
  for each row execute function public.set_updated_at();

-- Le client connecté a-t-il un accès actif à ce produit ? (« security definer » : évite les boucles de RLS)
create or replace function public.has_access(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e
     where e.product_id = p_product_id and e.user_id = auth.uid() and e.revoked_at is null
  )
$$;
revoke all on function public.has_access(uuid) from public, anon;
grant execute on function public.has_access(uuid) to authenticated, service_role;

drop policy if exists "Clients lisent leurs accès" on public.entitlements;
create policy "Clients lisent leurs accès" on public.entitlements for select
  using (auth.uid() = user_id or public.is_admin());

-- Deux politiques : les visiteurs (anon) n'exécutent pas is_admin() / has_access().
drop policy if exists "Tout le monde lit les produits publiés" on public.products;
create policy "Tout le monde lit les produits publiés" on public.products for select
  to anon, authenticated using (published);
drop policy if exists "Acheteurs et admins lisent leurs produits" on public.products;
create policy "Acheteurs et admins lisent leurs produits" on public.products for select
  to authenticated using (public.is_admin() or public.has_access(id));
drop policy if exists "Admins gèrent les produits" on public.products;
create policy "Admins gèrent les produits" on public.products for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Infos réservées aux acheteurs (lien du groupe WhatsApp, message d'accueil)
-- ---------------------------------------------------------------------------
create table if not exists public.product_private (
  product_id uuid primary key references public.products(id) on delete cascade,
  group_url text,
  welcome_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_private enable row level security;
drop trigger if exists product_private_updated_at on public.product_private;
create trigger product_private_updated_at before update on public.product_private
  for each row execute function public.set_updated_at();

drop policy if exists "Acheteurs lisent les infos privées" on public.product_private;
create policy "Acheteurs lisent les infos privées" on public.product_private for select
  using (public.has_access(product_id) or public.is_admin());
drop policy if exists "Admins gèrent les infos privées" on public.product_private;
create policy "Admins gèrent les infos privées" on public.product_private for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Leçons (vidéo sur notre serveur OU lien YouTube)
-- ---------------------------------------------------------------------------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  position integer not null default 0,
  title text not null,
  description text,
  video_path text,      -- chemin dans le stockage privé « videos » (lu par lien signé de courte durée)
  youtube_url text,
  duration_seconds integer,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lessons_product_idx on public.lessons (product_id, position);
alter table public.lessons enable row level security;
drop trigger if exists lessons_updated_at on public.lessons;
create trigger lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();

drop policy if exists "Acheteurs lisent les leçons" on public.lessons;
create policy "Acheteurs lisent les leçons" on public.lessons for select
  using (public.has_access(product_id) or public.is_admin());
drop policy if exists "Admins gèrent les leçons" on public.lessons;
create policy "Admins gèrent les leçons" on public.lessons for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Fichiers à télécharger (kits, zip), stockage privé « files »
-- ---------------------------------------------------------------------------
create table if not exists public.product_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  position integer not null default 0,
  title text not null,
  storage_path text not null,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists product_files_product_idx on public.product_files (product_id, position);
alter table public.product_files enable row level security;
drop trigger if exists product_files_updated_at on public.product_files;
create trigger product_files_updated_at before update on public.product_files
  for each row execute function public.set_updated_at();

drop policy if exists "Acheteurs lisent les fichiers" on public.product_files;
create policy "Acheteurs lisent les fichiers" on public.product_files for select
  using (public.has_access(product_id) or public.is_admin());
drop policy if exists "Admins gèrent les fichiers" on public.product_files;
create policy "Admins gèrent les fichiers" on public.product_files for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Progression : le client ne voit et ne coche que la sienne, sur des leçons auxquelles il a accès.
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists lesson_progress_lesson_idx on public.lesson_progress (lesson_id);
alter table public.lesson_progress enable row level security;

drop policy if exists "Clients lisent leur progression" on public.lesson_progress;
create policy "Clients lisent leur progression" on public.lesson_progress for select
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Clients cochent leurs leçons" on public.lesson_progress;
create policy "Clients cochent leurs leçons" on public.lesson_progress for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.lessons l where l.id = lesson_id and public.has_access(l.product_id))
  );
drop policy if exists "Clients décochent leurs leçons" on public.lesson_progress;
create policy "Clients décochent leurs leçons" on public.lesson_progress for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Demandes : accompagnements, services sur devis
-- Création et mise à jour côté serveur (routes API) ; le client lit les siennes.
-- ---------------------------------------------------------------------------
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  kind text not null check (kind in ('coaching', 'accompagnement', 'projet', 'design', 'audit', 'autre')),
  details text not null,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'nouvelle' check (status in ('nouvelle', 'en_cours', 'terminee', 'annulee')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_requests_user_idx on public.service_requests (user_id, created_at desc);
create index if not exists service_requests_product_idx on public.service_requests (product_id);
create index if not exists service_requests_status_idx on public.service_requests (status, created_at desc);
alter table public.service_requests enable row level security;
drop trigger if exists service_requests_updated_at on public.service_requests;
create trigger service_requests_updated_at before update on public.service_requests
  for each row execute function public.set_updated_at();

drop policy if exists "Clients lisent leurs demandes" on public.service_requests;
create policy "Clients lisent leurs demandes" on public.service_requests for select
  using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Admins gèrent les demandes" on public.service_requests;
create policy "Admins gèrent les demandes" on public.service_requests for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Commandes : produit acheté + coordonnées du client au moment de l'achat
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists customer_country text;
alter table public.orders add column if not exists new_account boolean not null default false;
create index if not exists orders_product_idx on public.orders (product_id);
create index if not exists orders_customer_email_idx on public.orders (lower(customer_email));

-- ---------------------------------------------------------------------------
-- Accorde l'accès à un produit ET aux produits qu'il inclut. Rejouable : un accès retiré est rendu.
-- ---------------------------------------------------------------------------
create or replace function public.grant_product_access(p_user_id uuid, p_product_id uuid, p_source text, p_order_id uuid default null, p_granted_by uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.entitlements (user_id, product_id, order_id, source, granted_by)
  select p_user_id, p.id, p_order_id, p_source, p_granted_by
    from public.products p
   where p.id = p_product_id
      or p.slug = any (select unnest(includes) from public.products where id = p_product_id)
  on conflict (user_id, product_id) do update
    set revoked_at = null,
        order_id = coalesce(public.entitlements.order_id, excluded.order_id);
end;
$$;
revoke all on function public.grant_product_access(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.grant_product_access(uuid, uuid, text, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Livraison d'une commande payée (remplace la version précédente) : UNE opération atomique,
-- jamais deux fois. Passe la commande en « success », accorde l'accès au produit (et les crédits s'il y en a).
-- ---------------------------------------------------------------------------
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
    perform public.grant_product_access(claimed.user_id, claimed.product_id, 'purchase', claimed.id, null);
  end if;

  return true;
end;
$$;
revoke all on function public.credit_paid_order(uuid, text) from public, anon, authenticated;
grant execute on function public.credit_paid_order(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Droits de l'API de données pour les nouvelles tables (la RLS filtre les lignes)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.products, public.product_private, public.lessons, public.product_files,
  public.entitlements, public.lesson_progress, public.service_requests to authenticated;
grant select on public.products to anon;
revoke all on public.product_private, public.lessons, public.product_files, public.entitlements,
  public.lesson_progress, public.service_requests from anon;
grant all on public.products, public.product_private, public.lessons, public.product_files,
  public.entitlements, public.lesson_progress, public.service_requests to service_role;

-- ---------------------------------------------------------------------------
-- Stockage PRIVÉ (vidéos et fichiers) : aucune politique, donc aucun accès direct depuis le navigateur.
-- Lecture par lien signé de courte durée créé par le serveur, envoi par lien d'envoi signé (admin).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('videos', 'videos', false) on conflict (id) do update set public = false;
    insert into storage.buckets (id, name, public) values ('files', 'files', false) on conflict (id) do update set public = false;
  end if;
end;
$$;
