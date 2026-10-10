import Image from "next/image";
import SectionTitle from "@/components/site/home/SectionTitle";
import { site } from "@/config/site";

// « À propos » de l'accueil : site.ts › about (null = section masquée).
export default function AboutShort({ index = "04" }: { index?: string }) {
  const about = site.about;
  if (!about) return null;
  return (
    <section id="a-propos" style={{ padding: "120px 24px", scrollMarginTop: 80 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <SectionTitle index={index} label="À propos">{about.title}</SectionTitle>
        <div className="about-short" style={{ display: "grid", gridTemplateColumns: about.photo ? "360px 1fr" : "1fr", gap: 56, alignItems: "start" }}>
          {about.photo && (
            <div style={{ position: "relative", aspectRatio: "4 / 5", borderRadius: 24, overflow: "hidden", background: "var(--black-mid)" }}>
              <Image src={about.photo} alt={site.person || site.name} fill sizes="360px" style={{ objectFit: "cover", objectPosition: "center 20%" }} />
            </div>
          )}
          <div>
            {about.paragraphs.map((p, i) => (
              <p key={i} style={i === 0
                ? { fontSize: "clamp(20px, 2.2vw, 28px)", lineHeight: 1.35, letterSpacing: "-0.015em", color: "var(--white)" }
                : { fontSize: 17, lineHeight: 1.65, color: "var(--white-muted)", marginTop: 16 }}>{p}</p>
            ))}
            {about.roles.length > 0 && (
              <ul style={{ listStyle: "none", display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
                {about.roles.map((r) => (
                  <li key={r} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid var(--black-line)", fontSize: 14, color: "var(--white-muted)" }}>{r}</li>
                ))}
              </ul>
            )}
            {about.link && (
              <a href={about.link.href} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 10, height: 52, padding: "0 26px", marginTop: 32, borderRadius: 999, background: "#fff", color: "#0D0D0D", fontSize: 16, fontWeight: 500, textDecoration: "none" }}>
                {about.link.label} ↗
              </a>
            )}
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 800px) { .about-short { grid-template-columns: 1fr !important; } }`}</style>
    </section>
  );
}
