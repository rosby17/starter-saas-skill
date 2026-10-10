import type { Metadata } from 'next'
import LegalPage from '@/components/site/LegalPage'
import { site, contactLink } from '@/config/site'

export const metadata: Metadata = { title: 'Mentions légales' }

export default function Page() {
  return (
    <LegalPage title="Mentions légales">
      <h2>Éditeur</h2>
      <p>{site.company.legalName} · {site.company.address}{site.company.taxId ? ` · N° fiscal : ${site.company.taxId}` : ''}</p>
      <p>Contact : <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> · WhatsApp {site.whatsapp ? <a href={contactLink()}>{site.whatsapp}</a> : '—'}</p>
      <h2>Hébergement</h2>
      <p>Site et base de données hébergés sur le serveur de l’éditeur (Coolify).</p>
      <h2>Propriété intellectuelle</h2>
      <p>Les vidéos, textes, visuels et fichiers de ce site appartiennent à {site.company.legalName}. Toute reproduction sans autorisation est interdite.</p>
    </LegalPage>
  )
}
