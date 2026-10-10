-- 09/10 : quand l'administrateur valide un paiement à la main (Binance, Mobile Money, virement…),
-- il renseigne le détail pour la comptabilité : moyen réel, référence, montant reçu, note, qui a validé et quand.
-- Le moyen et la référence réels remplacent payment_method / payment_ref ; les montants reçus servent à la page Revenus.
-- Rejouable.

alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists paid_amount_fcfa integer check (paid_amount_fcfa is null or paid_amount_fcfa >= 0);
alter table public.orders add column if not exists payment_note text;
alter table public.orders add column if not exists validated_by uuid references auth.users(id) on delete set null;
create index if not exists orders_validated_by_idx on public.orders (validated_by);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
