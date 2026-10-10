"use client";
import { useSyncExternalStore } from "react";

function subscribeToClock(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

// Heure courante, arrondie à la seconde, mise à jour chaque seconde.
// Vaut null pendant le rendu serveur : tout ce qui dépend de l'heure
// (compte à rebours, prix promo) n'apparaît qu'une fois la page chargée.
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribeToClock,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => null
  );
}
