import type { Metadata } from 'next'
import LegalPage from '@/components/site/LegalPage'
import { site } from '@/config/site'

export const metadata: Metadata = { title: 'Politique de confidentialité' }

export default function Page() {
  return (
    <LegalPage title="Politique de confidentialité">
      <p>Dernière mise à jour : 3 octobre 2026.</p>
      <h2>Données collectées</h2>
      <ul>
        <li>À l’achat ou lors d’une demande : nom, adresse e-mail, numéro WhatsApp, pays.</li>
        <li>Dans ton espace : tes achats, ta progression dans les cours, tes demandes et nos échanges.</li>
        <li>Paiement : la référence de la transaction. Nous ne voyons ni ne gardons tes coordonnées bancaires ou Mobile Money : elles sont saisies chez la passerelle de paiement.</li>
      </ul>
      <h2>Pourquoi</h2>
      <p>Pour te livrer ce que tu as acheté, t’envoyer ton lien d’accès, répondre à tes demandes, te contacter sur WhatsApp au sujet de ton achat et t’établir une facture.</p>
      <h2>Avec qui</h2>
      <p>Nos prestataires techniques, uniquement pour ces besoins : la passerelle de paiement choisie, Brevo (envoi des e-mails), et notre propre serveur qui héberge le site et la base de données. Le site utilise le pixel Meta pour mesurer l’efficacité de nos publicités.</p>
      <h2>Tes droits</h2>
      <p>Tu peux consulter, corriger ou faire supprimer tes données à tout moment : écris-nous à <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> ou sur <a href={site.whatsapp}>WhatsApp</a>.</p>
    </LegalPage>
  )
}
