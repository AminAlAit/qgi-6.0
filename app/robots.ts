/**
 * robots.txt route (T19 #312).
 *
 * Allows search engines to crawl public content. Disallows:
 *   - /login (auth page, not useful to index)
 *   - /api/  (protected + cost-sensitive)
 *
 * PR-iii (2026-05-15) — canonical cutover. The V1 + V2 legacy routes are
 * preserved at suffixed URLs (-v1, -v2a, -v2b, -v2-table, -v2-narrative)
 * so direct-URL access still works, but search engines shouldn't index
 * them (duplicate-content with the V3 canonicals).
 */
import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://qgintelligence.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/login",
          "/api/",
          // Legacy V1 — superseded by canonical V3 routes
          "/precedents-v1",
          "/countries-v1",
          "/signals-v1",
          "/patterns-v1",
          // Legacy V2 — design-preview variants kept reachable, not indexed
          "/precedents-v2a",
          "/precedents-v2b",
          "/countries-v2-table",
          "/countries-v2-narrative",
          "/signals-v2a",
          "/signals-v2b",
          "/patterns-v2a",
          "/patterns-v2b",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
