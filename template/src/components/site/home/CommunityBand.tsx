import Link from "next/link";
import { type Product } from "@/lib/catalog/types";
import { Price } from "@/components/Price";

import { COMMUNITY_SLUG } from "@/lib/catalog/slugs";
export { COMMUNITY_SLUG };

// La communauté : offerte avec chaque formation et accompagnement, ou seule en abonnement.
// Styles en ligne avec les variables de la charte, comme les autres bandes de l'accueil.
export default function CommunityBand({ products }: { products: Product[] }) {
  const pro = products.find((p) => p.slug === COMMUNITY_SLUG);
  if (!pro) return null;
  const points = pro.features.length ? pro.features : ["Annonces en avant-première", "Groupes de discussion et entraide", "Photos, vocaux, sondages et événements", "Comme sur WhatsApp, directement sur le site"];
  return (
    <div className="community-band" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 32, alignItems: "center", marginTop: 40, padding: "clamp(24px, 4vw, 44px)", borderRadius: 28, border: "1px solid var(--black-line)", background: "var(--black-card)" }}>
      <div>
        <p style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brand)", marginBottom: 12 }}>Inclus avec chaque formation</p>
        <h3 style={{ fontSize: "clamp(30px, 3.6vw, 46px)", lineHeight: 1.02, color: "var(--white)", marginBottom: 16 }}>{pro.title}</h3>
        <p style={{ fontSize: 17, color: "var(--white-muted)", lineHeight: 1.6, maxWidth: 560 }}>
          {pro.subtitle || "Annonces, entraide et échanges entre membres."} Elle est offerte avec chaque formation et chaque accompagnement.
        </p>
      </div>
      <div style={{ padding: 24, borderRadius: 22, background: "var(--black)", border: "1px solid var(--black-line)" }}>
        <ul style={{ display: "grid", gap: 10, listStyle: "none", marginBottom: 22 }}>
          {points.map((f) => (
            <li key={f} style={{ display: "flex", gap: 10, color: "var(--white)", fontSize: 15 }}>
              <span style={{ color: "var(--brand)", fontWeight: 900 }}>✓</span>
              {f}
            </li>
          ))}
        </ul>
        {pro.price_fcfa != null && (
          <p style={{ color: "var(--white-muted)", fontSize: 14, marginBottom: 14 }}>Sans formation : <strong style={{ color: "var(--white)" }}><Price fcfa={pro.price_fcfa} /></strong> par mois.</p>
        )}
        <Link href={`/boutique/${pro.slug}`} style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 52, borderRadius: 999, background: "var(--brand)", color: "#fff", fontWeight: 600, textDecoration: "none" }}>
          Découvrir la communauté →
        </Link>
      </div>
      <style>{`@media (max-width: 900px) { .community-band { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
