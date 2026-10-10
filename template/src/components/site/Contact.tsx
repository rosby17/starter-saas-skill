"use client";
import Link from "next/link";
import Image from "next/image";
import { contactChannel, contactLink, hasModule, site } from "@/config/site";
import { useCatalog } from "@/lib/catalog/context";
import { currentPrice } from "@/lib/catalog/types";
import { CALL_SLUG } from "@/lib/calls/slots";
import { useCurrency } from "@/lib/content/display-currency";
import { useCheckout } from "@/components/site/CheckoutModal";
import { CookieSettingsLink } from "@/components/CookieSettingsLink";

// Icônes des réseaux : monochromes (charte noir / blanc / rouge), rouges au survol.
const ICONS: Record<string, string> = {
  youtube: "M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z",
  facebook: "M24 12.1C24 5.4 18.6 0 12 0S0 5.4 0 12.1c0 6 4.4 11 10.1 11.9v-8.4H7.1v-3.5h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9v2.3h3.3l-.5 3.5h-2.8V24C19.6 23 24 18.1 24 12.1z",
  tiktok: "M12.5 0h4c.2 2 1.4 3.9 3.3 4.8.9.5 2 .7 3 .7v4a10 10 0 0 1-6.2-2.1v8.9a7.3 7.3 0 1 1-6.3-7.2v4.1a3.2 3.2 0 1 0 2.2 3.1V0z",
  linkedin: "M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6h.1c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM7.1 20.5H3.6V9h3.5v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z",
  github: "M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.2-3.1-.1-.4-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4 18.3 4.3 18.3 4.3c.7 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.1 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z",
  whatsapp: "M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.2l-.9 1.2c-.2.2-.4.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2-.2-.3 0-.5.1-.6l.5-.5.3-.5v-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5l1.7.6c.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.9 9.9 0 1 1 12 21.8zM20.5 3.5A11.8 11.8 0 0 0 .2 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.7a11.9 11.9 0 0 0 5.7 1.5c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.4-8.4z",
  instagram: "M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z",
  x: "M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.9 2.3h7l4.8 6.4 5.5-6.4zm-1.2 17.9h1.9L7.1 4.2H5.1l11.9 16z",
};

// Réseaux de site.socials (une adresse vide = réseau masqué) et WhatsApp du support.
const NETWORKS = [
  { key: "youtube", label: "YouTube", href: site.socials.youtube },
  { key: "facebook", label: "Facebook", href: site.socials.facebook },
  { key: "instagram", label: "Instagram", href: site.socials.instagram },
  { key: "tiktok", label: "TikTok", href: site.socials.tiktok },
  { key: "linkedin", label: "LinkedIn", href: site.socials.linkedin },
  { key: "x", label: "X", href: site.socials.x },
  { key: "whatsapp", label: "WhatsApp", href: site.whatsapp ? contactLink() : "" },
].filter((n) => n.href);

type Col = { title: string; links: { label: string; href: string; external?: boolean }[] };
const COLUMNS: Col[] = [
  hasModule("formations") && { title: "Formations", links: [{ label: "Toutes les formations", href: "/formations" }, { label: "Accompagnements", href: "/boutique#accompagnement" }] },
  hasModule("boutique") && { title: "Boutique", links: [{ label: "Produits", href: "/boutique#logiciel" }, { label: "Services", href: "/boutique#service" }, { label: "Toute la boutique", href: "/boutique" }] },
  { title: "Contact", links: [
    ...(site.whatsapp ? [{ label: site.whatsapp, href: contactLink(), external: true }] : []),
    { label: site.supportEmail, href: `mailto:${site.supportEmail}` },
    ...(hasModule("demandes") ? [{ label: "Demander un devis", href: "/demandes/nouvelle" }] : []),
  ] },
  { title: "Espace membre", links: [{ label: "Connexion", href: "/login" }, { label: "Mes achats", href: "/mes-achats" }, { label: "Aide", href: "/support" }] },
  { title: "Légal", links: [{ label: "Mentions légales", href: "/mentions-legales" }, { label: "CGV", href: "/terms" }, { label: "Confidentialité", href: "/privacy" }] },
].filter(Boolean) as Col[];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

// Bas de chaque page publique : réseaux et contact, carte « appel » (produit appel-1h en base, si publié), pied de page.
export default function Contact() {
  const catalog = useCatalog();
  const call = hasModule("appels") ? catalog.find((p) => p.slug === CALL_SLUG) : undefined;
  const callPrice = call ? currentPrice(call) : null;
  const { formatPrice } = useCurrency();
  const { openCheckout } = useCheckout();

  return (
    <>
      <section id="contact" style={{ padding: "120px 24px", borderTop: "1px solid var(--black-line)", scrollMarginTop: 80 }}>
        <div className="contact-inner" style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: call && callPrice ? "1.2fr 1fr" : "1fr", gap: 48, alignItems: "start" }}>
          <div>
            <p style={{ fontSize: 13, color: "var(--white-dim)", marginBottom: 16 }}>Nous retrouver</p>
            <h2 style={{ fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 500, letterSpacing: "-0.045em", lineHeight: 1, color: "var(--white)" }}>
              On reste connectés.
              <br />
              <span style={{ color: "var(--white-dim)" }}>Une question ? On répond.</span>
            </h2>
            <p style={{ fontSize: 16, color: "var(--white-muted)", lineHeight: 1.6, margin: "20px 0 32px", maxWidth: 520 }}>
              Écris-nous sur {contactChannel()} ou suis-nous sur les réseaux : nouveautés, conseils et annonces.
            </p>

            <a href={contactLink(`Bonjour, je vous contacte depuis le site ${site.name}.`)} target="_blank" rel="noopener noreferrer" className="lift" style={portfolioCard}>
              <Image src={site.logo} alt="" width={56} height={56} style={{ borderRadius: 999, objectFit: "cover", flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 18, fontWeight: 500, color: "var(--white)" }}>Nous écrire</span>
                <span style={{ display: "block", fontSize: 14, color: "var(--white-dim)", marginTop: 2 }}>{site.whatsapp || site.supportEmail}</span>
              </span>
              <span className="go" aria-hidden style={{ fontSize: 20, color: "var(--white-dim)" }}>↗</span>
            </a>

            {NETWORKS.length > 0 && (
              <div className="net-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10 }}>
                {NETWORKS.map((n) => (
                  <a key={n.label} href={n.href} target="_blank" rel="noopener noreferrer" className="lift" style={netCard}>
                    <span className="ico" style={{ color: "var(--white)" }}><Icon name={n.key} /></span>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: "var(--white)" }}>{n.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {call && callPrice != null && (
            <div style={{ background: "var(--black-card)", border: "1px solid var(--black-line)", borderRadius: 24, padding: "36px 32px" }}>
              <p style={{ fontSize: 13, color: "var(--white-dim)" }}>{call.title}</p>
              <p style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.15, color: "var(--white)", margin: "10px 0 12px" }}>
                Prêt à réserver un appel ?
              </p>
              <p style={{ fontSize: 14, color: "var(--white-muted)", lineHeight: 1.6, marginBottom: 28 }}>
                {call.subtitle || "Une heure d’échange sur ton projet : tes questions, ta stratégie, tes prochaines étapes."}
              </p>
              <button type="button" onClick={() => openCheckout(CALL_SLUG)} className="offer offer-main" style={{ ...offerBtn, background: "var(--brand)", color: "#fff", border: "1px solid var(--brand)" }}>
                <span style={{ textAlign: "left" }}>
                  <span style={{ display: "block", fontSize: 12, opacity: 0.85 }}>Réserver</span>
                  <span style={{ display: "block", fontSize: 17, fontWeight: 500 }}>{formatPrice(callPrice)}</span>
                </span>
                {call.compare_at_fcfa != null && call.compare_at_fcfa > callPrice && (
                  <span style={{ fontSize: 13, opacity: 0.75, textDecoration: "line-through" }}>{formatPrice(call.compare_at_fcfa)}</span>
                )}
              </button>
            </div>
          )}
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--black-line)", padding: "72px 24px 32px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="foot-top" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 2.4fr", gap: 56 }}>
            <div>
              <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                <Image src={site.logo} alt="" width={40} height={40} style={{ borderRadius: 999, objectFit: "cover" }} />
                <span style={{ fontSize: 18, fontWeight: 500, color: "var(--white)" }}>{site.name}</span>
              </Link>
              <p style={{ fontSize: 14, color: "var(--white-muted)", lineHeight: 1.6, margin: "18px 0 22px", maxWidth: 320 }}>{site.description}</p>
              {hasModule("boutique") && (
                <Link href="/boutique" className="foot-cta" style={footCta}>
                  Découvrir la boutique <span aria-hidden>↗</span>
                </Link>
              )}
              {NETWORKS.length > 0 && (
                <ul style={{ display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none", marginTop: 22 }}>
                  {NETWORKS.map((n) => (
                    <li key={n.label}>
                      <a href={n.href} target="_blank" rel="noopener noreferrer" aria-label={n.label} className="round" style={roundIcon}>
                        <Icon name={n.key} size={15} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <nav aria-label="Pied de page" className="foot-cols" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(COLUMNS.length, 4)}, 1fr)`, gap: "40px 24px" }}>
              {COLUMNS.map((col) => (
                <div key={col.title}>
                  <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--white)", marginBottom: 16 }}>{col.title}</p>
                  <ul style={{ listStyle: "none", display: "grid", gap: 11 }}>
                    {col.links.map((l) => (
                      <li key={l.label}>
                        {l.external ? (
                          <a href={l.href} target="_blank" rel="noopener noreferrer" className="foot-link">{l.label}</a>
                        ) : (
                          <Link href={l.href} className="foot-link">{l.label}</Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid var(--black-line)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13, color: "var(--white-dim)" }}>
            <span>© {new Date().getFullYear()} {site.name}. Tous droits réservés.</span>
            <span style={{ display: "flex", gap: 16 }}><CookieSettingsLink className="foot-link" /><span>{site.tagline}</span></span>
          </div>
        </div>

        <style>{`
          .lift { transition: border-color 0.2s ease, transform 0.2s ease; }
          .lift:hover { border-color: var(--line-strong) !important; transform: translateY(-2px); }
          .lift:hover .ico, .lift:hover .go { color: var(--brand) !important; }
          .offer { transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease; }
          .offer:hover { transform: translateY(-2px); border-color: var(--line-strong) !important; }
          .offer-main:hover { background: var(--brand-dim) !important; border-color: var(--brand-dim) !important; }
          .foot-link { font-size: 14px; color: var(--white-dim); text-decoration: none; transition: color 0.2s ease; }
          .foot-link:hover { color: var(--white); }
          .round { transition: color 0.2s ease, border-color 0.2s ease; }
          .round:hover { color: var(--brand) !important; border-color: var(--brand) !important; }
          .foot-cta:hover { background: var(--brand-dim) !important; }
          @media (max-width: 1000px) {
            .contact-inner { grid-template-columns: 1fr !important; }
            .foot-top { grid-template-columns: 1fr !important; gap: 48px !important; }
          }
          @media (max-width: 760px) {
            .foot-cols { grid-template-columns: repeat(2, 1fr) !important; }
            .net-grid { grid-template-columns: repeat(2, 1fr) !important; }
          }
        `}</style>
      </footer>
    </>
  );
}

const portfolioCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: 18,
  borderRadius: 16,
  border: "1px solid var(--black-line)",
  background: "var(--black-card)",
  textDecoration: "none",
};

const netCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid var(--black-line)",
  textDecoration: "none",
  minWidth: 0,
};

const offerBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  width: "100%",
  padding: "14px 18px",
  borderRadius: 14,
  cursor: "pointer",
  font: "inherit",
};

const footCta: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  height: 44,
  padding: "0 20px",
  borderRadius: 999,
  background: "var(--brand)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 500,
  textDecoration: "none",
  transition: "background 0.2s ease",
};

const roundIcon: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 38,
  height: 38,
  borderRadius: 999,
  border: "1px solid var(--black-line)",
  color: "var(--white-muted)",
};
