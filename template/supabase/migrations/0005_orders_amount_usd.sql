-- Montant de la commande en USD : certaines passerelles (K-Pay) facturent en dollars et le webhook compare le montant reçu à celui-ci.
alter table public.orders add column if not exists amount_usd numeric not null default 0;
