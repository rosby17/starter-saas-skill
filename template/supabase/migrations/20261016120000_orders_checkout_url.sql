-- URL de la page de paiement, gardée sur la commande « pending » : une nouvelle tentative du même achat reprend cette
-- page au lieu d'en ouvrir une deuxième (voir api/payment/checkout). Idempotent.
alter table public.orders add column if not exists checkout_url text;
