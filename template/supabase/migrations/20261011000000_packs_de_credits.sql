-- PACKS DE CRÉDITS : un SaaS à l'usage (voix, images, vidéos, génération d'applications…) vend des crédits
-- comme n'importe quel produit du catalogue. Le produit de catégorie « credits » porte le nombre de crédits
-- et leur durée de validité ; le paiement passe par la même page de paiement et la même livraison atomique
-- (credit_paid_order verse orders.credits avec leur date de fin). Rejouable.
alter table public.products drop constraint if exists products_category_check;
alter table public.products add constraint products_category_check
  check (category in ('formation', 'abonnement', 'accompagnement', 'logiciel', 'service', 'credits'));
alter table public.products add column if not exists credits integer not null default 0;
alter table public.products drop constraint if exists products_credits_check;
alter table public.products add constraint products_credits_check check (credits >= 0);
alter table public.products add column if not exists credits_validity_days integer;
alter table public.products drop constraint if exists products_credits_validity_days_check;
alter table public.products add constraint products_credits_validity_days_check
  check (credits_validity_days is null or credits_validity_days between 1 and 3660);
