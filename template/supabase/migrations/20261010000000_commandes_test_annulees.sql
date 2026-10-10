-- 10/10 : une commande peut être marquée « test » (bac à sable : jamais comptée dans les ventes)
-- et une commande abandonnée peut être « annulée » (sortie de la liste courante). Rejouable.
alter table public.orders add column if not exists is_test boolean not null default false;
create index if not exists orders_is_test_idx on public.orders (is_test) where is_test;

