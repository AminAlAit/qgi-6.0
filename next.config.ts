import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Next.js 16 config.
 *
 * T16 #309 (2026-04-19) — performance tuning:
 *  - `optimizePackageImports` rewrites `import * as Flags from "country-flag-icons/react/3x2"`
 *    so only the flag components actually referenced are bundled, instead of
 *    all 272 SVG components landing in every route that touches CountryFlag.
 *  - `echarts` similarly benefits — only the chart types the app uses ship.
 *  - AVIF/WebP image formats automatic for `next/image` usages.
 *  - `poweredByHeader: false` strips the `X-Powered-By: Next.js`
 *    fingerprint from responses (small security hygiene win).
 */
const nextConfig: NextConfig = {
  // #440: typed routes promote `<Link href="/...">` to a compile-time
  // contract. A typo in any internal route (or a stale link to a
  // deleted page) becomes a build failure instead of a silent runtime
  // 404 — same regression class #426 was triaging post-hoc; with this
  // on, those links would never have compiled. Stable in Next 16, no
  // longer behind `experimental`.
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["country-flag-icons", "echarts", "echarts-for-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
  /**
   * PR-ii (2026-05-15) — V2 route consistent naming.
   *
   * The previous V2 routes used inconsistent naming (`/discover-patterns-a`
   * for Patterns vs `/precedents-v2-a` for Precedents). Renamed to a
   * uniform `{family}-v2{variant}` scheme so a future reader can read the
   * URL and know the family + variant without checking the brief.
   *
   * 308 permanent redirects from the old paths preserve any bookmark or
   * external inbound link. Status 308 (vs 301) keeps the HTTP method on
   * the follow — irrelevant for these GET-only routes today, but the
   * safer default.
   *
   * These redirects can be removed once external links to the old paths
   * are confirmed gone (search for inbound traffic in Vercel analytics
   * after 90 days; safe to drop if zero).
   */
  async redirects() {
    return [
      // Patterns V2: drop the V1-era "discover-patterns" prefix
      {
        source: "/discover-patterns-a",
        destination: "/patterns-v2a",
        permanent: true,
      },
      {
        source: "/discover-patterns-a/:slug*",
        destination: "/patterns-v2a/:slug*",
        permanent: true,
      },
      {
        source: "/discover-patterns-b",
        destination: "/patterns-v2b",
        permanent: true,
      },
      {
        source: "/discover-patterns-b/:slug*",
        destination: "/patterns-v2b/:slug*",
        permanent: true,
      },
      // Signals V2: drop the internal hyphen
      {
        source: "/signals-v2-a",
        destination: "/signals-v2a",
        permanent: true,
      },
      {
        source: "/signals-v2-a/:path*",
        destination: "/signals-v2a/:path*",
        permanent: true,
      },
      {
        source: "/signals-v2-b",
        destination: "/signals-v2b",
        permanent: true,
      },
      {
        source: "/signals-v2-b/:path*",
        destination: "/signals-v2b/:path*",
        permanent: true,
      },
      // Precedents V2: drop the internal hyphen
      {
        source: "/precedents-v2-a",
        destination: "/precedents-v2a",
        permanent: true,
      },
      {
        source: "/precedents-v2-a/:slug*",
        destination: "/precedents-v2a/:slug*",
        permanent: true,
      },
      {
        source: "/precedents-v2-b",
        destination: "/precedents-v2b",
        permanent: true,
      },
      {
        source: "/precedents-v2-b/:slug*",
        destination: "/precedents-v2b/:slug*",
        permanent: true,
      },

      // ─── PR-iii (2026-05-15) — V3 -merged → canonical + V1 → -v1 ────────
      //
      // The atomic canonical rename. V3 now serves the unsuffixed canonical
      // URLs; V1 lives at -v1; bookmarks at the old -merged paths 308 here.
      //
      // V1 sub-routes that conflict with V3 (e.g. /patterns/ranking and
      // /signals/country which V3 does NOT serve) get explicit redirects
      // to their -v1 archive locations so old bookmarks don't 404.
      //
      // V1 BASE paths (/precedents, /countries, /signals, /patterns) are
      // NOT redirected — they're the new canonical V3 URLs now. Anyone
      // bookmarking V1's base path lands on V3 (intentional cutover).
      // To explicitly access V1, use the -v1 suffix.

      // V3 -merged URLs → canonical (for any external link still using -merged)
      {
        source: "/precedents-merged",
        destination: "/precedents",
        permanent: true,
      },
      {
        source: "/precedents-merged/:slug*",
        destination: "/precedents/:slug*",
        permanent: true,
      },
      {
        source: "/countries-merged",
        destination: "/countries",
        permanent: true,
      },
      {
        source: "/countries-merged/:path*",
        destination: "/countries/:path*",
        permanent: true,
      },
      {
        source: "/signals-merged",
        destination: "/signals",
        permanent: true,
      },
      {
        source: "/signals-merged/:path*",
        destination: "/signals/:path*",
        permanent: true,
      },
      {
        source: "/patterns-merged",
        destination: "/patterns",
        permanent: true,
      },
      {
        source: "/patterns-merged/:slug*",
        destination: "/patterns/:slug*",
        permanent: true,
      },

      // V1 sub-routes that have NO V3 counterpart — preserved at -v1
      {
        source: "/patterns/ranking",
        destination: "/patterns-v1/ranking",
        permanent: true,
      },
      {
        source: "/signals/country",
        destination: "/signals-v1/country",
        permanent: true,
      },
    ];
  },
};

/**
 * Sentry build-time integration (#451).
 *
 * Wraps the config so the Sentry webpack plugin runs on Vercel deploys:
 *  - Uploads source maps to Sentry (gated on SENTRY_AUTH_TOKEN; absent
 *    locally so dev builds aren't slowed by an auth call that 401s).
 *  - Tags releases with the git SHA Vercel injects.
 *  - Tunnels Sentry events through `/monitoring` to dodge ad blockers
 *    that would otherwise drop client-side error reports — common with
 *    finance/political analyst audiences who run aggressive blockers.
 *
 * `silent: true` so the build log doesn't get a wall of Sentry chatter.
 */
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  // Tunnel Sentry events through /monitoring on our own domain. Bypasses
  // ad blockers + privacy extensions that block sentry.io directly.
  tunnelRoute: "/monitoring",
  // Don't fail the build if source-map upload fails (e.g. token rotation
  // mid-deploy). Errors still flow into Sentry; we just lose source-map
  // resolution for that release.
  errorHandler: (err: Error) => {
    console.warn("[sentry] source-map upload failed (non-fatal):", err.message);
  },
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
