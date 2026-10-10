import Link from "next/link";
import { site } from "@/config/site";

// Premier écran : titre net aligné à gauche, le texte d'accroche, deux boutons pastille, les domaines.
// Tout se règle dans site.ts › hero. Fond uni, aucun dégradé.
export default function HomeHero() {
  const h = site.hero;
  return (
    <section style={{ padding: "148px 24px 0", maxWidth: 1280, margin: "0 auto" }}>
      {h.badge.text && (
        <Link href={h.badge.href} className="hero-badge" style={badge} data-no-reveal>
          <span style={{ color: "var(--brand)", fontWeight: 500 }}>{h.badge.label}</span>
          <span style={{ color: "var(--white-muted)" }}>{h.badge.text}</span>
          <span aria-hidden style={{ color: "var(--white-dim)" }}>→</span>
        </Link>
      )}

      <h1
        data-no-reveal
        style={{
          marginTop: 28,
          fontSize: "clamp(44px, 7.4vw, 104px)",
          fontWeight: 500,
          letterSpacing: "-0.05em",
          lineHeight: 0.98,
          color: "var(--white)",
          maxWidth: 900,
        }}
      >
        <span style={{ display: "block", animation: "fadeUp 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both" }}>
          {h.title} <span style={{ color: "var(--brand)", whiteSpace: "nowrap" }}>{h.highlight}</span>
        </span>
      </h1>

      <div className="hero-row" style={{ marginTop: 32, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32, flexWrap: "wrap", animation: "fadeUp 0.8s 0.3s both" }}>
        <div style={{ maxWidth: 620 }}>
          <p style={{ fontSize: "clamp(17px, 1.5vw, 20px)", lineHeight: 1.5, color: "var(--white-muted)" }}>{h.text}</p>
          {h.motto && <p style={{ marginTop: 14, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--brand)" }}>{h.motto}</p>}
        </div>
        <div className="hero-ctas" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={site.modules.formations ? "/formations" : "/boutique"} className="btn-light" style={btnLight}>{site.modules.formations ? "Voir les formations" : "Voir la boutique"}</Link>
          <Link href="/signup" className="btn-dark" style={btnDark}>S&apos;inscrire gratuitement</Link>
        </div>
      </div>

      {h.chips.length > 0 && (
        <ul aria-label="Domaines" className="hero-domains" style={{ marginTop: 36, display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none", animation: "fadeUp 0.8s 0.4s both" }}>
          {h.chips.map((d) => (
            <li key={d} data-no-reveal style={chip}>{d}</li>
          ))}
        </ul>
      )}

      <style>{`
        .hero-badge:hover { border-color: var(--line-strong) !important; }
        .btn-light:hover { background: #E5E5E5 !important; }
        .btn-dark:hover { background: var(--black-line) !important; }
        @media (max-width: 700px) {
          .hero-ctas, .hero-ctas > a { width: 100%; justify-content: center; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-row, .hero-domains, h1 span { animation: none !important; }
        }
      `}</style>
    </section>
  );
}

const badge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  height: 34,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid var(--black-line)",
  background: "var(--black-card)",
  fontSize: 14,
  textDecoration: "none",
  animation: "fadeUp 0.6s both",
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 46,
  padding: "0 22px",
  borderRadius: 999,
  fontSize: 15,
  fontWeight: 500,
  textDecoration: "none",
  whiteSpace: "nowrap",
  transition: "background 0.2s ease",
};

const btnLight: React.CSSProperties = { ...pill, background: "#FAFAFA", color: "#0D0D0D" };
const btnDark: React.CSSProperties = { ...pill, background: "var(--black-mid)", color: "var(--white)" };

const chip: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 999,
  border: "1px solid var(--black-line)",
  fontSize: 13,
  color: "var(--white-muted)",
};


