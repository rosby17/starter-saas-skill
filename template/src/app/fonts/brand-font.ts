import localFont from "next/font/local";

// Police de la charte (fichiers locaux : aucun appel à Google au build). Inter, licence libre SIL OFL 1.1.
// Changer de police : remplacer les 3 fichiers ici ET dans public/fonts (factures PDF), puis les noms ci-dessous.
export const brandFont = localFont({
  src: [
    { path: "./Inter-Regular.ttf", weight: "400", style: "normal" },
    { path: "./Inter-Medium.ttf", weight: "500", style: "normal" },
    { path: "./Inter-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-brand",
  display: "swap",
});
