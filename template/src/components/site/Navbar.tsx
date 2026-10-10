"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/site/ThemeToggle";
import { site, hasModule } from "@/config/site";

// Menu classique : les rubriques sont visibles d'un coup d'œil, sans menu caché.
const LINKS = site.nav.filter((l) => !l.module || hasModule(l.module));

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Sur téléphone, le menu déroulant se ferme avec Échap ou en changeant de page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) => {
    const path = href.split("#")[0] || "/";
    return path !== "/" && !href.includes("#") && pathname.startsWith(path);
  };

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 300,
        background: "var(--nav-bg)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--black-line)",
      }}
    >
      <nav style={{ maxWidth: 1280, margin: "0 auto", height: 68, padding: "0 20px", display: "flex", alignItems: "center", gap: 24 }}>
        <Link href="/" onClick={() => setOpen(false)} aria-label="Accueil" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
          <Image src={site.logo} alt={site.name} width={38} height={38} style={{ borderRadius: "50%", objectFit: "cover", border: "1px solid var(--black-line)" }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: "var(--white)" }}>{site.name}</span>
        </Link>

        <ul className="nav-links" style={{ display: "flex", alignItems: "center", gap: 4, listStyle: "none", margin: "0 auto" }}>
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="nav-link" data-active={isActive(l.href) || undefined}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="nav-actions" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <ThemeToggle />
          <Link href="/login" style={{ ...pill("transparent", "var(--white)"), border: "1px solid var(--black-line)" }}>
            Connexion
          </Link>
          <Link href="/signup" style={pill("var(--brand)", "#fff")}>
            S&apos;inscrire
          </Link>
        </div>

        <button
          type="button"
          className="nav-burger"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          style={{ marginLeft: "auto", width: 44, height: 44, borderRadius: 12, border: "1px solid var(--black-line)", background: "transparent", color: "var(--white)", cursor: "pointer", display: "none", placeItems: "center" }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="nav-mobile" style={{ borderTop: "1px solid var(--black-line)", padding: "12px 20px 20px", background: "var(--nav-bg)" }}>
          <ul style={{ listStyle: "none", display: "grid", gap: 2 }}>
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="nav-mobile-link">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
            <Link href="/login" onClick={() => setOpen(false)} style={{ ...pill("transparent", "var(--white)"), border: "1px solid var(--black-line)", justifyContent: "center" }}>
              Connexion
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)} style={{ ...pill("var(--brand)", "#fff"), justifyContent: "center" }}>
              S&apos;inscrire
            </Link>
          </div>
          <div style={{ marginTop: 14 }}>
            <ThemeToggle />
          </div>
        </div>
      )}

      <style>{`
        .nav-link { display: block; padding: 8px 14px; border-radius: 999px; font-size: 15px; color: var(--white-muted); text-decoration: none; white-space: nowrap; transition: color .15s, background .15s; }
        .nav-link:hover, .nav-link[data-active] { color: var(--white); background: var(--black-mid); }
        .nav-mobile-link { display: block; padding: 12px 8px; font-size: 17px; color: var(--white); text-decoration: none; border-bottom: 1px solid var(--black-line); }
        @media (max-width: 1100px) {
          .nav-links, .nav-actions { display: none !important; }
          .nav-burger { display: grid !important; }
        }
        @media (min-width: 1101px) { .nav-mobile { display: none; } }
      `}</style>
    </header>
  );
}

function pill(bg: string, color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    height: 42,
    padding: "0 18px",
    borderRadius: 999,
    background: bg,
    color,
    fontSize: 15,
    fontWeight: 500,
    textDecoration: "none",
    whiteSpace: "nowrap",
  };
}
