-- Suppression de compte (droit à l'effacement) SANS perdre la comptabilité :
-- les commandes restent (factures, chiffre d'affaires), seulement détachées du compte supprimé.
alter table public.orders alter column user_id drop not null;
alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders add constraint orders_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
