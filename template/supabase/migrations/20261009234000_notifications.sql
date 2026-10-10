-- 09/10 : notifications des élèves (nouveau module, nouvelle leçon, annonce d'une formation).
-- Écrites par le serveur (clé service) quand l'administrateur annonce une nouveauté ; l'élève lit les siennes
-- et les marque comme lues. Elles partent aussi par e-mail. Rejouable.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text check (body is null or char_length(body) <= 1000),
  url text check (url is null or url ~ '^/(?!/)'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_product_idx on public.notifications (product_id);
alter table public.notifications enable row level security;

drop policy if exists "Élèves lisent leurs notifications" on public.notifications;
create policy "Élèves lisent leurs notifications" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "Élèves marquent leurs notifications lues" on public.notifications;
create policy "Élèves marquent leurs notifications lues" on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Les élèves ne changent que read_at (pas le texte ni le lien).
revoke insert, update, delete on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
