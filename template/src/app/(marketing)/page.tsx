import Link from "next/link";
import Navbar from "@/components/site/Navbar";
import Contact from "@/components/site/Contact";
import Faq from "@/components/site/Faq";
import HomeHero from "@/components/site/home/HomeHero";
import AboutShort from "@/components/site/home/AboutShort";
import SectionTitle from "@/components/site/home/SectionTitle";
import CallBand, { CALL_SLUG } from "@/components/site/home/CallBand";
import CommunityBand from "@/components/site/home/CommunityBand";
import ProductCard, { productCardCss } from "@/components/site/ProductCard";
import { getPublishedProducts } from "@/lib/catalog/server";
import { COMMUNITY_SLUG } from "@/lib/catalog/slugs";
import { hasModule } from "@/config/site";

// Accueil : tout vient du catalogue en base (/admin/products) et de site.ts (textes, modules).
// Une section sans produit publié ne s'affiche pas.
export default async function Home() {
  const products = await getPublishedProducts();
  const courses = hasModule("formations") ? products.filter((p) => p.category === "formation" || p.category === "accompagnement") : [];
  const credits = hasModule("credits") ? products.filter((p) => p.category === "credits") : [];
  const shop = hasModule("boutique") ? products.filter((p) => p.category === "logiciel" || (p.category === "service" && p.slug !== CALL_SLUG)) : [];
  const showCall = hasModule("appels") && products.some((p) => p.slug === CALL_SLUG);
  const showCommunity = hasModule("communaute") && products.some((p) => p.slug === COMMUNITY_SLUG);
  let n = 0;
  const idx = () => String(++n).padStart(2, "0");

  return (
    <>
      <Navbar />
      <HomeHero />

      {courses.length > 0 && (
        <section id="formations" style={section}>
          <div style={inner}>
            <SectionTitle index={idx()} label="Formations" aside={<Link href="/formations" style={asideLink}>Toutes les formations →</Link>}>
              Apprends sur des projets réels,
              <br />
              <span style={{ color: "var(--white-dim)" }}>à ton rythme.</span>
            </SectionTitle>
            <div className="home-grid">{courses.map((p) => <ProductCard key={p.id} product={p} />)}</div>
            {showCommunity && <CommunityBand products={products} />}
          </div>
        </section>
      )}

      {credits.length > 0 && (
        <section id="credits" style={section}>
          <div style={inner}>
            <SectionTitle index={idx()} label="Crédits">
              Paie seulement
              <br />
              <span style={{ color: "var(--white-dim)" }}>ce que tu utilises.</span>
            </SectionTitle>
            <div className="home-grid">{credits.map((p) => <ProductCard key={p.id} product={p} />)}</div>
          </div>
        </section>
      )}

      {(showCall || shop.length > 0) && (
        <section id="services" style={section}>
          <div style={inner}>
            <SectionTitle index={idx()} label="Boutique et services"
              aside={hasModule("boutique") ? <Link href="/boutique" style={asideLink}>Toute la boutique →</Link> : undefined}>
              Des produits prêts à l&apos;emploi,
              <br />
              <span style={{ color: "var(--white-dim)" }}>ou on le fait pour toi.</span>
            </SectionTitle>
            {showCall && <CallBand products={products} />}
            {shop.length > 0 && <div className="home-grid">{shop.map((p) => <ProductCard key={p.id} product={p} />)}</div>}
          </div>
        </section>
      )}

      <style>{productCardCss + `.home-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }`}</style>
      <AboutShort index={idx()} />
      <Faq />
      <Contact />
    </>
  );
}

const section: React.CSSProperties = { padding: "96px 24px 24px", scrollMarginTop: 80 };
const inner: React.CSSProperties = { maxWidth: 1280, margin: "0 auto" };
const asideLink: React.CSSProperties = { fontSize: 16, color: "var(--white)", textDecoration: "none", borderBottom: "1px solid var(--brand)", paddingBottom: 4 };
