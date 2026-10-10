-- 10/10 : nom d'utilisateur (@pseudo) affiché dans la communauté, choisi dans Mon compte. Rejouable.
alter table public.profiles add column if not exists username text;
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check check (username is null or username ~ '^[a-z0-9_.]{3,30}$');
create unique index if not exists profiles_username_key on public.profiles (lower(username)) where username is not null;
