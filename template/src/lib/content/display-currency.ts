"use client";

import { useState, useEffect, useCallback } from "react";
import { chargedCurrencyLabel, currencyForCountry, formatAmount, localEquivalent, regionalPrice, type DisplayCurrency } from "@/lib/pricing/zones";

export type Currency = DisplayCurrency;

const SYMBOLS: Record<Currency, string> = { XAF: "FCFA", XOF: "FCFA", EUR: "€", USD: "$" };

// Pays du visiteur, demandé UNE fois par page (et non à chaque prix affiché).
// Le serveur refait la même détection au paiement : le prix payé est celui affiché.
let countryPromise: Promise<string> | null = null;
function detectCountry(): Promise<string> {
  countryPromise ??= fetch("https://get.geojs.io/v1/ip/country.json")
    .then((r) => r.json())
    .then((d: { country?: string }) => (d.country || "").toUpperCase())
    .catch(() => "");
  return countryPromise;
}

export function useCurrency() {
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    detectCountry().then((cc) => alive && setCountry(cc));
    return () => {
      alive = false;
    };
  }, []);

  const isLoaded = country !== null;
  const currency = currencyForCountry(country);

  const formatPriceParts = useCallback(
    (basePriceFCFA: number, suffix: string = "") => {
      if (country === null) return { value: "...", symbol: SYMBOLS[currency] + suffix };
      const { amount, currency: cur } = regionalPrice(basePriceFCFA, country);
      const [value] = formatAmount(amount, cur).split(` ${SYMBOLS[cur]}`);
      return { value, symbol: SYMBOLS[cur] + suffix };
    },
    [country, currency]
  );

  const formatPrice = useCallback(
    (basePriceFCFA: number, suffix: string = "") => {
      if (country === null) return "...";
      const { amount, currency: cur } = regionalPrice(basePriceFCFA, country);
      return formatAmount(amount, cur) + suffix;
    },
    [country]
  );

  /** Ordre de grandeur dans la devise locale (Inde, Royaume-Uni, Nigeria…), ou null. */
  const localPrice = useCallback(
    (basePriceFCFA: number) => (country === null ? null : localEquivalent(regionalPrice(basePriceFCFA, country), country)),
    [country]
  );

  return { currency, country, isLoaded, formatPrice, formatPriceParts, localPrice, chargedLabel: chargedCurrencyLabel(currency) };
}
