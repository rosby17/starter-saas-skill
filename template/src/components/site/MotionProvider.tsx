"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Animation d'apparition au scroll appliquée à tout le site, sans avoir à
// modifier chaque page : titres révélés derrière un masque, textes et médias
// qui glissent en se défloutant, en cascade quand ils arrivent ensemble.
//
// Règles pour ne jamais laisser une page blanche :
// - ce qui est déjà à l'écran au chargement n'est jamais caché ;
// - un élément est révélé dès que son haut passe dans l'écran, ou s'il est
//   au-dessus (scroll rapide, lien d'ancre) : quelle que soit sa taille ;
// - les classes sont posées par JavaScript : sans JS, tout reste visible.
const TARGETS = "h1, h2, h3, h4, p, li, figure, blockquote, img, video, table";
const SKIP = "nav, [role='dialog'], #showreel, [data-no-reveal], .rv";

export default function MotionProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Espace client et administration : pas d'animation d'apparition (tableaux, formulaires).
    if (/^\/(admin|mes-achats|cours|demandes|dashboard|settings|support|billing|login|signup|reset-password|setup)(\/|$)/.test(pathname)) return;

    let pending: HTMLElement[] = [];
    let frame = 0;

    const reveal = () => {
      frame = 0;
      const limit = window.innerHeight * 0.94;
      let i = 0;
      pending = pending.filter((el) => {
        if (!el.isConnected) return false;
        if (el.getBoundingClientRect().top > limit) return true;
        const delay = `${Math.min(i++, 5) * 60}ms`;
        el.style.transitionDelay = delay;
        el.style.animationDelay = delay;
        el.classList.add("rv-in");
        // Le délai de cascade ne doit pas ralentir les effets de survol ensuite.
        setTimeout(() => {
          el.style.transitionDelay = "";
          el.style.animationDelay = "";
        }, 1200);
        return false;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(reveal);
    };

    const scan = (root: HTMLElement) => {
      const found = [...root.querySelectorAll<HTMLElement>(TARGETS)];
      if (root.matches(TARGETS)) found.unshift(root);
      const fold = window.innerHeight;
      found.forEach((el) => {
        if (el.closest(SKIP)) return;
        // Un élément dont un parent est déjà animé suit son parent.
        if (el.parentElement?.closest(".rv")) return;
        // Déjà visible : on n'y touche pas, pour ne jamais faire "clignoter"
        // un contenu que le visiteur lit déjà.
        if (el.getBoundingClientRect().top < fold) return;
        const isHeading = /^H[1-3]$/.test(el.tagName);
        el.classList.add("rv", isHeading ? "rv-mask" : "rv-fade");
        pending.push(el);
      });
    };

    scan(document.body);

    // Contenus ajoutés après coup (FAQ ouverte, changement de page, modales…).
    const mutations = new MutationObserver((records) => {
      records.forEach((r) =>
        r.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) scan(node);
        })
      );
      schedule();
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Filet de sécurité : si un événement de scroll est manqué, on rattrape.
    const safety = window.setInterval(reveal, 800);

    return () => {
      mutations.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.clearInterval(safety);
      cancelAnimationFrame(frame);
      // En quittant la page, rien ne doit rester caché.
      pending.forEach((el) => el.classList.add("rv-in"));
    };
  }, [pathname]);

  return null;
}
