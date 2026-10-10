"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getCookieConsent, onCookieConsentChange } from "@/lib/cookie-consent";

// Pixel Meta (facultatif) : NEXT_PUBLIC_META_PIXEL_ID dans l'environnement. Sans identifiant, rien n'est chargé.
// PageView à chaque page (navigation client comprise), les autres évènements
// passent par track() : InitiateCheckout à l'ouverture du paiement, Purchase
// quand le paiement est confirmé.
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: unknown };
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

function init() {
  if (window.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = window._fbq = fbq;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  fbq("init", META_PIXEL_ID);
}

export function track(event: string, params?: Record<string, unknown>) {
  // Pixel publicitaire : seulement après « Accepter » dans le bandeau des cookies.
  if (typeof window === "undefined" || !META_PIXEL_ID || getCookieConsent() !== "accepted") return;
  init();
  window.fbq!("track", event, params);
}

export default function MetaPixel() {
  const pathname = usePathname();
  useEffect(() => {
    track("PageView");
  }, [pathname]);
  useEffect(() => onCookieConsentChange((choice) => { if (choice === "accepted") track("PageView"); }), []);
  return null;
}
