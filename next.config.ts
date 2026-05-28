import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * #748 PR-3 (#751) — Retired precedent slugs (2026-05-17).
 *
 * These slugs used to 301-redirect to `/precedents`. That route is now
 * deleted as part of the V4.1 canonical promotion (2026-05-28). The list
 * is kept here for reference but is no longer used in redirects().
 *
 * RETIRED_PRECEDENT_SLUGS is unused; kept for audit trail.
 */
const RETIRED_PRECEDENT_SLUGS = [
  "government_formation",
  "constitutional_change",
  "decentralization_and_federalism",
  "democratic_transition",
  "executive_power_consolidation",
  "military_coup",
  "coup_attempt_or_succession",
  "transitional_justice",
  "peacekeeping_and_peace_process",
  "constitutional_referendum",
  "interstate_war",
  "terrorist_attack",
  "foreign_intervention",
  "ethnic_and_communal_conflict",
  "political_violence",
  "ceasefire_agreement",
  "west_bank_violence",
  "israeli_military_operation",
  "rocket_attack",
  "political_repression",
  "political_corruption",
  "human_rights_violation",
  "human_rights_reform",
  "military_policy_and_reform",
  "currency_crisis",
  "banking_and_financial_crisis",
  "economic_recession",
  "fiscal_policy_change",
  "monetary_policy_change",
  "economic_liberalization",
  "economic_nationalization",
  "economic_recovery",
  "economic_growth_milestone",
  "economic_growth",
  "trade_agreement",
  "trade_dispute",
  "foreign_direct_investment",
  "industrial_policy",
  "sanctions_and_arms_embargo",
  "foreign_aid_and_development",
  "economic_struggle",
  "economic_crisi",
  "economic_reform",
  "mass_protest",
  "labor_action",
  "social_policy_reform",
  "public_health_reform",
  "poverty_and_inequality_crisis",
  "religious_and_social_movement",
  "migration_and_refugees",
  "political_unrest",
  "social_program",
  "diplomatic_rupture",
  "territorial_disputes",
  "regional_integration",
  "diplomatic_effort",
  "international_diplomacy",
  "earthquake",
  "flood_and_cyclone",
  "volcanic_eruption",
  "natural_disaster",
  "drought_and_famine",
  "epidemic_and_pandemic",
  "humanitarian_crisis",
  "water_crisis",
  "pandemic_response",
  "humanitarian_crisi",
  "energy_policy",
  "oil_and_gas",
  "renewable_energy",
  "environmental_policy",
  "climate_agreement",
  "resource_conflict",
  "infrastructure_project",
  "urban_development",
  "education_reform",
  "education_and_research",
  "digital_policy",
  "technology_breakthrough",
  "cyberattack",
  "cultural_and_heritage",
  "sport_and_international_event",
  "agricultural_policy",
  "environmental_effort",
  "infrastructure_development",
  "cultural_heritage",
];

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
   * 2026-05-28 — V4.1 canonical promotion redirects.
   *
   * Only four redirect families remain after the V4.1 promo:
   *  1. /precedents-v4.1 → /recipes (bookmark preservation)
   *  2. /recipes/foreign_intervention → /blog (graduation article)
   *  3. /countries-merged → /countries (PR-iii legacy)
   *  4. /patterns-merged → /patterns (PR-iii legacy)
   *  5. /blog/ghana-mauritania-mirror → /reports (elevation redirect)
   *
   * All redirects that targeted deleted routes (/precedents, /signals,
   * /patterns-v1, /signals-v1, /patterns-v2a, /patterns-v2b, etc.) have
   * been removed — 404 is better than a redirect to a 404.
   */
  async redirects() {
    return [
      // 2026-05-28 — V4.1 canonical promotion. /precedents-v4.1 was the
      // pre-canonical URL for the Recipes surface; preserve bookmarks.
      {
        source: "/precedents-v4.1",
        destination: "/recipes",
        permanent: true,
      },
      {
        source: "/precedents-v4.1/:path*",
        destination: "/recipes/:path*",
        permanent: true,
      },

      // (Removed 2026-05-28) The previous redirect from
      // /recipes/foreign_intervention → /blog/foreign-intervention-graduation
      // was retired when /recipes-v4.1/ was promoted to /recipes/, because
      // foreign_intervention is now the canonical demo recipe slug for the
      // V4.1 detail page. The blog graduation article is still live at
      // /blog/foreign-intervention-graduation; visit it directly.

      // Old -merged URLs from the PR-iii (2026-05-15) V3 rename.
      // /countries and /patterns now serve V4.1 canonical routes.
      // /precedents and /signals are deleted; their -merged aliases
      // would 404 so they are not redirected.
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
        source: "/patterns-merged",
        destination: "/patterns",
        permanent: true,
      },
      {
        source: "/patterns-merged/:slug*",
        destination: "/patterns/:slug*",
        permanent: true,
      },

      // ─── 2026-05-19 — Ghana piece elevation from /blog to /reports ────
      {
        source: "/blog/ghana-mauritania-mirror",
        destination: "/reports/ghana-mauritania-mirror",
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
