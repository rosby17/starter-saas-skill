import { contactChannel, contactLink, hasModule, site } from '@/config/site'

// Habillage commun de TOUS les e-mails (accès, demandes, alertes, codes, messages du coach) :
// en-tête sombre avec le logo sur une pastille de la couleur de marque et un trait de couleur, carte de contenu
// (sur-titre et titre facultatifs), puis un pied de page en trois parties : carte d'aide, liens du site,
// mentions et raison de l'envoi. Tables et styles en ligne : Gmail, Outlook et Apple Mail les lisent tous.

// Couleurs de la marque : mêmes valeurs que --brand et --on-brand dans src/app/globals.css (un e-mail ne lit pas le CSS du site).
export const BRAND = '#C8102E'
export const ON_BRAND = '#FFFFFF'
/** Fond très clair de la marque (étiquettes). */
export const BRAND_SOFT = '#FBE7EA'
export const INK = '#111112'
export const DARK = '#161618'
export const MUTED = '#6b7280'
export const LINE = '#ececef'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
// Logo en PNG (Gmail n'affiche pas le SVG). Un logo blanc sur fond transparent reste lisible : il est posé sur la pastille de marque.
const LOGO = '/pwa/icon-192.png'

// Tout texte inséré dans un e-mail passe par esc() : un nom ou un titre ne doit jamais injecter de HTML.
export const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** Bouton principal aux couleurs de la marque ; variant 'ghost' : bouton secondaire bordé. */
export const emailButton = (href: string, label: string, variant: 'primary' | 'ghost' = 'primary') => {
  const td = variant === 'primary' ? `background:${BRAND};border-radius:12px` : `border:1.5px solid ${LINE};border-radius:12px`
  const color = variant === 'primary' ? ON_BRAND : INK
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px"><tr><td style="${td}">
  <a href="${esc(href)}" style="display:inline-block;padding:14px 26px;color:${color};font-family:${FONT};font-weight:700;font-size:15px;line-height:1;text-decoration:none">${esc(label)}</a>
  </td></tr></table>`
}

/** Petite étiquette (sujet, rubrique, statut). */
export const emailTag = (label: string) =>
  `<span style="display:inline-block;padding:5px 11px;border-radius:999px;background:${BRAND_SOFT};color:${BRAND};font-size:12px;font-weight:700;letter-spacing:.2px">${esc(label)}</span>`

/** Bloc encadré gris clair avec un trait de marque (citation, message, récapitulatif). `html` doit être déjà échappé. */
export const emailPanel = (html: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0"><tr>
  <td style="width:4px;background:${BRAND};border-radius:4px 0 0 4px"></td>
  <td style="padding:16px 18px;background:#f7f7f8;border-radius:0 12px 12px 0;font-size:15px;line-height:1.65;color:${INK}">${html}</td>
  </tr></table>`

type LayoutOptions = {
  body: string
  /** Une phrase « Tu reçois cet e-mail parce que… », propre à chaque modèle. */
  reason: string
  /** Texte d'aperçu affiché dans la boîte de réception, à côté du sujet. */
  preheader?: string
  /** Petit sur-titre au-dessus du titre (ex. « Achat confirmé »). */
  eyebrow?: string
  /** Grand titre en haut de la carte. */
  title?: string
}

export function emailLayout({ body, reason, preheader = '', eyebrow, title }: LayoutOptions): string {
  const url = site.url.replace(/\/+$/, '')
  const host = url.replace(/^https?:\/\//, '')
  const year = new Date().getFullYear()
  const navLink = (href: string, label: string) =>
    `<a href="${url}${href}" style="color:${INK};font-weight:600;text-decoration:none">${esc(label)}</a>`
  const smallLink = (href: string, label: string) =>
    `<a href="${url}${href}" style="color:${MUTED};text-decoration:underline">${label}</a>`
  const dot = `<span style="color:#c4c4cc;padding:0 8px">&middot;</span>`
  // Liens du site : le menu public (modules allumés seulement), puis l'espace client.
  const links = site.nav.filter((l) => (!l.module || hasModule(l.module)) && !l.href.includes('#'))
  const nav = [...links.filter((l) => l.href !== '/dashboard'), { href: '/dashboard', label: 'Mon espace' }]
  const contact = contactLink()

  const heading = title
    ? `<tr><td style="padding:30px 32px 0">
        ${eyebrow ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:${BRAND}">${esc(eyebrow)}</p>` : ''}
        <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:800;color:${INK}">${esc(title)}</h1>
      </td></tr>`
    : ''

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(site.name)}</title></head>
<body style="margin:0;padding:0;background:#f2f2f4;-webkit-text-size-adjust:100%">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f4"><tr><td align="center" style="padding:32px 14px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;font-family:${FONT};color:${INK}">

  <!-- En-tête -->
  <tr><td style="background:${DARK};border-radius:20px 20px 0 0;padding:20px 32px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><a href="${url}" style="text-decoration:none;color:#ffffff">
        <img src="${url}${LOGO}" width="22" height="22" alt="" style="vertical-align:middle;border:0;background:${BRAND};padding:7px;border-radius:11px">
        <span style="vertical-align:middle;margin-left:10px;font-size:18px;font-weight:800;letter-spacing:-.2px;color:#ffffff">${esc(site.name)}</span>
      </a></td>
      <td align="right" style="font-size:12px;color:#a1a1aa">${esc(site.tagline)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="height:4px;background:${BRAND};line-height:4px;font-size:0">&nbsp;</td></tr>

  <!-- Contenu -->
  <tr><td style="background:#ffffff;border-radius:0 0 20px 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${heading}
      <tr><td style="padding:${title ? '18px' : '32px'} 32px 32px;font-size:15px;line-height:1.7;color:#27272a">${body}</td></tr>
    </table>
  </td></tr>

  <!-- Aide -->
  <tr><td style="padding:16px 0 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px"><tr>
      <td style="padding:18px 22px;font-size:14px;line-height:1.6;color:#3f3f46">
        <strong style="color:${INK}">Une question&nbsp;?</strong> Réponds simplement à cet e-mail : une vraie personne te répond.
        <br><a href="${esc(contact)}" style="color:${BRAND};font-weight:600;text-decoration:none">${site.whatsapp ? `Écrire sur ${contactChannel()}` : esc(site.supportEmail)}</a>
      </td>
    </tr></table>
  </td></tr>

  <!-- Liens du site -->
  <tr><td align="center" style="padding:24px 10px 6px;font-size:14px">
    ${nav.map((l) => navLink(l.href, l.label)).join(dot)}
  </td></tr>

  <!-- Mentions et raison de l'envoi -->
  <tr><td align="center" style="padding:14px 24px 0;font-size:12px;line-height:1.7;color:${MUTED}">
    ${esc(reason)}<br>
    ${smallLink('/privacy', 'Confidentialité')}${dot}${smallLink('/terms', 'Conditions')}${dot}${smallLink('/mentions-legales', 'Mentions légales')}<br>
    &copy; ${year} ${esc(site.company.legalName || site.name)} &middot; <a href="${url}" style="color:${MUTED};text-decoration:none">${esc(host)}</a>
  </td></tr>

</table></td></tr></table></body></html>`
}
