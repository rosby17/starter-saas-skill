import type { Metadata } from 'next'
import LegalPage from '@/components/site/LegalPage'
import { site, contactLink } from '@/config/site'

export const metadata: Metadata = { title: 'Conditions générales de vente' }

export default function Page() {
  return (
    <LegalPage title="Conditions générales de vente">
      <p>Dernière mise à jour : 3 octobre 2026.</p>
      <h2>1. Objet</h2>
      <p>Les présentes conditions encadrent les ventes conclues sur ce site entre {site.company.legalName} (« le vendeur ») et toute personne qui achète une formation, un accompagnement, un produit numérique ou un service (« le client »).</p>
      <h2>2. Commande et paiement</h2>
      <p>Le prix affiché est en francs CFA (FCFA), toutes taxes comprises. Le paiement se fait en ligne (Mobile Money, carte bancaire, PayPal) ou par crypto-monnaie (Binance Pay, validation manuelle). Pour commander, le client indique son nom, son adresse e-mail et son numéro WhatsApp ; un compte client est créé à partir de son adresse e-mail.</p>
      <h2>3. Livraison</h2>
      <ul>
        <li><strong>Formations et produits numériques</strong> : accès donné dès la confirmation du paiement, dans l’espace « Formations », et lien d’accès envoyé par e-mail. Accès à vie au contenu acheté, sous réserve du respect de l’article 5.</li>
        <li><strong>Accompagnements</strong> : le client remplit un formulaire de départ ; la date des séances est fixée ensemble.</li>
        <li><strong>Services sur devis</strong> : prix et délai convenus par écrit avant le début du travail.</li>
      </ul>
      <h2>4. Rétractation et remboursement</h2>
      <p>Pour un contenu numérique fourni immédiatement, le client accepte, en payant, que l’exécution commence aussitôt. Un remboursement reste possible en cas de problème technique empêchant l’accès et que nous ne parvenons pas à résoudre. Écris-nous via WhatsApp ou par e-mail.</p>
      <h2>5. Usage personnel</h2>
      <p>Les contenus sont réservés à l’usage personnel du client. Il est interdit de les partager, de les revendre, de les télécharger ou de les diffuser. Les vidéos sont marquées avec l’adresse e-mail du client. En cas de partage constaté, l’accès peut être retiré sans remboursement.</p>
      <h2>6. Contact</h2>
      <p>WhatsApp : {site.whatsapp ? <a href={contactLink()}>{site.whatsapp}</a> : '—'} · E-mail : <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a></p>
    </LegalPage>
  )
}
