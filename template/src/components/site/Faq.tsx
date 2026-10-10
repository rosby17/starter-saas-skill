"use client";
import { useState } from "react";
import { contactChannel, contactLink, site } from "@/config/site";

const FAQS = site.faq;

export default function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  if (!FAQS.length) return null;

  return (
    <section
      id="faq"
      style={{
        padding: "120px 0",
        background: "var(--black-card)",
        borderTop: "1px solid var(--black-line)",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 28px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "360px 1fr",
            gap: 100,
            alignItems: "start",
          }}
          className="faq-inner"
        >
          {/* Sticky left */}
          <div style={{ position: "sticky", top: 120 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "var(--brand)", marginBottom: 18,
            }}>
              <span style={{ display: "block", width: 24, height: 1, background: "var(--brand)" }} />
              FAQ
            </div>
            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(32px, 4vw, 48px)",
              fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.08,
              color: "var(--white)", marginBottom: 16,
            }}>
              Les questions<br />
              <em style={{ fontStyle: "italic", color: "var(--brand)" }}>qu&apos;on nous pose.</em>
            </h2>
            <p style={{ fontSize: 15, color: "var(--white-muted)", lineHeight: 1.75, marginBottom: 32 }}>
              D&apos;autres questions ? Pose-les directement sur {contactChannel()}.
            </p>
            <a
              href={contactLink(`Bonjour, j'ai une question sur ${site.name}.`)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "transparent",
                color: "#25D366",
                border: "1px solid rgba(37,211,102,0.4)",
                padding: "12px 22px",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                transition: "background 0.2s, transform 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(37,211,102,0.08)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
              </svg>
              <span>Écrire sur WhatsApp</span>
            </a>
          </div>

          {/* Accordion */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {FAQS.map((f, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={i}
                  style={{
                    borderBottom: "1px solid var(--black-line)",
                    ...(i === 0 ? { borderTop: "1px solid var(--black-line)" } : {}),
                  }}
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    style={{
                      width: "100%",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "24px 0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      textAlign: "left",
                      fontFamily: "var(--font-body)",
                      fontSize: 15,
                      fontWeight: 500,
                      color: isOpen ? "var(--brand)" : "var(--white)",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      !isOpen && (e.currentTarget.style.color = "var(--white-muted)")
                    }
                    onMouseLeave={(e) =>
                      !isOpen && (e.currentTarget.style.color = "var(--white)")
                    }
                  >
                    {f.q}
                    <span
                      style={{
                        width: 28, height: 28,
                        borderRadius: "50%",
                        border: `1px solid ${isOpen ? "var(--brand)" : "var(--black-line)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                        color: isOpen ? "var(--brand)" : "var(--white-dim)",
                        fontSize: 18,
                        fontWeight: 300,
                        transform: isOpen ? "rotate(45deg)" : "none",
                        transition: "transform 0.3s, border-color 0.2s, color 0.2s",
                      }}
                    >
                      +
                    </span>
                  </button>
                  <div
                    style={{
                      maxHeight: isOpen ? 300 : 0,
                      overflow: "hidden",
                      transition: "max-height 0.35s ease, padding 0.3s",
                      fontSize: 14,
                      color: "var(--white-muted)",
                      lineHeight: 1.75,
                      padding: isOpen ? "0 0 24px" : 0,
                    }}
                  >
                    {f.a}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .faq-inner { grid-template-columns: 1fr !important; gap: 48px !important; }
          .faq-inner > div:first-child { position: static !important; }
        }
      `}</style>
    </section>
  );
}
