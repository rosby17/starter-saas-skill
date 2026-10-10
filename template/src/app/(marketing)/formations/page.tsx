import type { Metadata } from "next";
import Navbar from "@/components/site/Navbar";
import Contact from "@/components/site/Contact";
import { notFound } from "next/navigation";
import { hasModule, site } from "@/config/site";
import ProductCard, { productCardCss } from "@/components/site/ProductCard";
import CommunityBand from "@/components/site/home/CommunityBand";
import { getPublishedProducts } from "@/lib/catalog/server";

export const metadata: Metadata = {
  title: `Formations — ${site.name}`,
  description: "Des formations et des accompagnements sur des projets réels, de A à Z.",
};

export default async function FormationsPage() {
  if (!hasModule("formations")) notFound();
  const products = await getPublishedProducts();
  const sections = [
    { id: "formation", title: "Les formations", text: "Tu regardes, tu refais chez toi, tu poses tes questions. Accès à vie." },
    { id: "accompagnement", title: "Les accompagnements", text: "La formation, plus un accompagnement en direct sur TON projet." },
  ];
  return (
    <>
      <Navbar />
      <main style={{ padding: "150px 24px 120px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <p style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--white-muted)", marginBottom: 18 }}>
            <span style={{ color: "var(--brand)" }}>✲</span> Formations
          </p>
          <h1
            style={{
              fontSize: "clamp(48px, 9vw, 140px)",
              fontWeight: 500,
              letterSpacing: "-0.05em",
              lineHeight: 0.92,
              color: "var(--white)",
              marginBottom: 56,
            }}
          >
            Ce que tu vas
            <br />
            <span style={{ color: "var(--brand)" }}>apprendre.</span>
          </h1>
          {sections.map((sec) => {
            const items = products.filter((p) => p.category === sec.id);
            if (!items.length) return null;
            return (
              <section key={sec.id} id={sec.id} style={{ marginTop: 96, scrollMarginTop: 100 }}>
                <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", color: "var(--white)" }}>{sec.title}</h2>
                <p style={{ color: "var(--white-muted)", margin: "8px 0 28px", fontSize: 17 }}>{sec.text}</p>
                <div className="formations-grid">{items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
              </section>
            );
          })}
          {hasModule("communaute") && <div style={{ marginTop: 96 }}><CommunityBand products={products} /></div>}
          <style>{productCardCss + `.formations-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }`}</style>
        </div>
      </main>
      <Contact />
    </>
  );
}
