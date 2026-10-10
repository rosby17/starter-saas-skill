-- CATALOGUE D'EXEMPLE : de quoi voir le site complet dès l'installation (formation avec parcours, accompagnement,
-- abonnement « Rester à jour », communauté, appel, pack de crédits, service sur devis).
-- À remplacer dans /admin/products : titres, textes, prix, images. Jamais écrasé si le produit existe déjà. Rejouable.
insert into public.products (slug, category, title, subtitle, description, features, price_fcfa, compare_at_fcfa, billing, period_days, covers_all, includes, request_kind, credits, credits_validity_days, published, position)
values
  ('formation-exemple', 'formation', 'Formation exemple',
   'Remplace ce texte : le résultat concret que l’élève obtient à la fin.',
   'Décris ici la formation : pour qui, ce qu’on y apprend, comment elle se déroule. Ce texte se modifie dans Administration › Formations et produits.',
   array['Accès à vie à la version achetée', 'Parcours étape par étape', 'Fichiers à télécharger', 'Accès à la communauté'],
   15000, 20000, 'one_time', 30, false, array['abonnement-mises-a-jour'], null, 0, null, true, 10),
  ('accompagnement-exemple', 'accompagnement', 'Accompagnement exemple',
   'La formation, plus un suivi en direct sur le projet de l’élève.',
   'Décris ici l’accompagnement : séances, suivi, livrables.',
   array['La formation incluse', 'Séances en direct', 'Suivi personnalisé'],
   60000, null, 'one_time', 30, false, array['formation-exemple'], 'accompagnement', 0, null, true, 20),
  ('abonnement-mises-a-jour', 'abonnement', 'Rester à jour',
   'Chaque nouveau module de tes formations dès sa sortie.',
   'Ton achat reste à vie. L’abonnement débloque ce qui est ajouté ensuite à tes formations. Sans engagement : tu renouvelles quand tu veux, le temps restant s’ajoute.',
   array['Nouveaux modules dès leur sortie', 'Support', 'Sans engagement'],
   5000, null, 'monthly', 30, true, array[]::text[], null, 0, null, true, 30),
  ('communaute', 'abonnement', 'Communauté',
   'Annonces, entraide et échanges entre membres.',
   'La communauté privée de la plateforme : annonces en avant-première, groupes de discussion, sondages et événements. Incluse avec chaque formation.',
   array['Annonces en avant-première', 'Groupes de discussion', 'Photos, vidéos et fichiers partagés'],
   2500, null, 'monthly', 30, false, array[]::text[], null, 0, null, true, 40),
  ('appel-1h', 'service', 'Appel d’une heure',
   'Réserve une heure d’échange en visio.',
   'Après le paiement, propose jusqu’à 3 créneaux : tu reçois la confirmation et le lien de l’appel.',
   array['1 h en visio', 'Créneau au choix', 'Lien envoyé par e-mail'],
   20000, null, 'one_time', 30, false, array[]::text[], null, 0, null, true, 50),
  ('pack-credits-exemple', 'credits', '1 000 crédits',
   'Pour un SaaS à l’usage : chaque génération consomme des crédits.',
   'Exemple de pack de crédits. Les crédits s’ajoutent au solde dès le paiement confirmé.',
   array['1 000 crédits', 'Valables 1 an', 'Cumulables'],
   5000, null, 'one_time', 30, false, array[]::text[], null, 1000, 365, false, 60),
  ('service-sur-devis', 'service', 'Service sur devis',
   'Décris ton besoin : tu reçois une proposition et un prix.',
   null,
   array['Étude de ton besoin', 'Proposition chiffrée', 'Suivi dans ton espace'],
   null, null, 'one_time', 30, false, array[]::text[], 'projet', 0, null, true, 70)
on conflict (slug) do nothing;

-- Parcours de démonstration de la formation exemple (modifiable leçon par leçon dans l'admin).
insert into public.lessons (product_id, position, title, section, summary, description, released_at, blocks)
select p.id, v.position, v.title, v.section, v.summary, v.summary, '2020-01-01T00:00:00Z', v.blocks::jsonb
  from public.products p
  cross join (values
    (10, 'Bienvenue', 'Bienvenue', 'Ce que tu vas construire et comment suivre le parcours.',
     '[{"t":"p","text":"Bienvenue ! Remplace ce texte par ta présentation."},{"t":"tip","title":"Conseil","text":"Avance leçon par leçon : chaque étape s’appuie sur la précédente."}]'),
    (20, 'Première étape', 'Module 1', 'La première compétence, pas à pas.',
     '[{"t":"step","title":"Comprendre"},{"t":"p","text":"Explique la notion avec un exemple concret."},{"t":"step","title":"Pratiquer"},{"t":"todo","title":"À toi de jouer","items":["Refais l’exemple chez toi","Note tes questions pour la communauté"]}]'),
    (30, 'Vérifier ses acquis', 'Module 1', 'Un mini-quiz pour valider le module.',
     '[{"t":"quiz","q":"Quelle est la bonne méthode ?","options":["Tout lire d’un coup","Avancer étape par étape"],"answer":1,"explain":"Chaque étape prépare la suivante."}]')
  ) as v(position, title, section, summary, blocks)
 where p.slug = 'formation-exemple'
   and not exists (select 1 from public.lessons l where l.product_id = p.id);
