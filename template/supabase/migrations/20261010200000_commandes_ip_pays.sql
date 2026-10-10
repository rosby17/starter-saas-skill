-- 10/10 : chaque commande garde l'adresse IP vue par le serveur, le pays qu'elle désigne et la zone de prix
-- appliquée, pour comprendre un prix inattendu (VPN, relais privé, opérateur mal localisé). Rejouable.
alter table public.orders add column if not exists client_ip text;
alter table public.orders add column if not exists ip_country text;
alter table public.orders add column if not exists price_zone text;
