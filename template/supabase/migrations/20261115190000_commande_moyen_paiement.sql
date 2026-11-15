-- Moyen de paiement choisi par le client (mobile_money, card, paypal…) sur chaque commande.
-- Une même passerelle (Warappay) sert plusieurs moyens : la reprise d'une commande « pending » doit se faire avec le
-- MÊME moyen, sinon le client qui passe de la carte à PayPal retombe sur sa page carte (NERDS Academy, 15/11/2026).
alter table public.orders add column if not exists payment_type text;
