import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const baseConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'" },
        ],
      },
    ];
  },
};

// Le serveur de développement (npm run dev) écrit dans .next-dev, le build (npm run build) dans .next :
// lancer un build pendant que le site tourne en local ne peut plus casser ses fichiers (CSS et JS en 404, page sans style).
export default function nextConfig(phase: string): NextConfig {
  return { ...baseConfig, distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next' };
}
