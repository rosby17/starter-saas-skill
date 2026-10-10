import Link from "next/link";
import { activePromo, productHref, type Product } from "@/lib/catalog/types";
import { Price } from "@/components/Price";

import { CALL_SLUG } from "@/lib/calls/slots";
export { CALL_SLUG };

// Mise en avant de l'appel payant : tant que le produit n'existe pas (ou n'est pas publié), rien ne s'affiche.
export default function CallBand({ products }: { products: Product[] }) {
  const call = products.find((p) => p.slug === CALL_SLUG);
  if (!call || call.price_fcfa == null) return null;
  const promo = activePromo(call);

  return (
    <div className="call-band" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 32, alignItems: "center", padding: "clamp(24px, 4vw, 44px)", borderRadius: 28, border: "1px solid var(--brand)", background: "var(--brand-soft)", marginBottom: 40 }}>
      <div>
        <p style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brand)", marginBottom: 12 }}>☕ Une heure rien que pour toi</p>
        <h3 style={{ fontSize: "clamp(30px, 3.6vw, 48px)", lineHeight: 1.02, color: "var(--white)", marginBottom: 16 }}>{call.title}</h3>
        <p style={{ fontSize: 17, color: "var(--white-muted)", lineHeight: 1.6, maxWidth: 560 }}>
          {call.subtitle || "Réserve une heure d’échange en visio : tes questions, ton projet, tes prochaines étapes."}
        </p>
      </div>
      <div style={{ padding: 24, borderRadius: 22, background: "var(--black-card)", border: "1px solid var(--black-line)" }}>
        <ul style={{ display: "grid", gap: 10, listStyle: "none", marginBottom: 22 }}>
          {(call.features.length ? call.features : ["Une heure en visio", "Créneau au choix", "Lien envoyé par e-mail"]).map((f) => (
            <li key={f} style={{ display: "flex", gap: 10, color: "var(--white)", fontSize: 15 }}>
              <span style={{ color: "var(--brand)", fontWeight: 900 }}>✓</span>
              {f}
            </li>
          ))}
        </ul>
        <p style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--white)" }}><Price fcfa={promo?.priceFcfa ?? call.price_fcfa} /></span>
          <span style={{ color: "var(--white-muted)" }}>l&apos;heure</span>
        </p>
        <Link href={productHref(call)} style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 52, borderRadius: 999, background: "var(--brand)", color: "#fff", fontWeight: 600, textDecoration: "none" }}>
          Réserver mon heure →
        </Link>
      </div>
      <style>{`@media (max-width: 900px) { .call-band { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
