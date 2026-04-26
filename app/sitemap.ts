/**
 * Dynamic sitemap (T19 #312).
 *
 * Enumerates every public route + every country-profile + category
 * drill-down from the baked country-risks.json. Regenerated on the page
 * revalidation cadence (hourly) so new countries + categories surface
 * within an hour of a pipeline run.
 */
import type { MetadataRoute } from "next";
import { loadCountryRisks } from "@/lib/country-risks";
import { countrySlug } from "@/lib/slug";
import { CATEGORY_L1_MAP } from "@/lib/category-taxonomy";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://qgintelligence.com";

// Revalidate hourly; this is cheap because loadCountryRisks() is in-process
// cached and the JSON is ~2.6 MB.
export const revalidate = 3600;

// Static top-level pages.
const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/countries", changeFrequency: "daily", priority: 0.9 },
  { path: "/patterns", changeFrequency: "weekly", priority: 0.7 },
  { path: "/patterns/ranking", changeFrequency: "weekly", priority: 0.8 },
  { path: "/signals", changeFrequency: "weekly", priority: 0.8 },
  { path: "/precedents", changeFrequency: "weekly", priority: 0.7 },
  { path: "/methodology", changeFrequency: "monthly", priority: 0.8 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.6 },
  {
    path: "/blog/margin-over-persistence-trajectory",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    path: "/blog/cross-country-normalization",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    path: "/blog/curation-in-practice",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  { path: "/reports", changeFrequency: "monthly", priority: 0.6 },
  // #430 (2026-04-24): FSI demo report re-added to sitemap. Agent 7 QA
  // audit confirmed it renders fully with proper metadata + print CSS.
  // Also re-linked from /reports index so it's reachable via normal nav.
  {
    path: "/reports/fsi-qgi-report",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  { path: "/about", changeFrequency: "monthly", priority: 0.4 },
  { path: "/legal", changeFrequency: "monthly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // #464: V2.0 canonical URLs.
  //   /precedents/{slug}                — Recipe (one per L3 category)
  //   /signals/{country-slug}           — country-rolled-up watchlist
  //   /signals/{country-slug}/{slug}    — country-vs-recipe leaf
  //   /countries/{id}                   — country profile (unchanged)
  //   /countries/{id}/{cat}             — DROPPED (301 to /signals/...)
  //
  // The old /countries/{id}/{cat} entries are gone because the route
  // 301-redirects. Search engines should crawl the canonical
  // /signals/{slug}/{cat} URL — emitting both invites duplicate-content
  // signals.

  // /precedents/{slug} — one per L3 taxonomy code (71 entries).
  for (const slug of Object.keys(CATEGORY_L1_MAP)) {
    entries.push({
      url: `${BASE_URL}/precedents/${slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // Country-profile + signals routes.
  try {
    const data = await loadCountryRisks();
    const lastMod = data.generated_at ? new Date(data.generated_at) : now;
    for (const [id, country] of Object.entries(data.countries)) {
      // /countries/{id} — country profile (unchanged from V1.x).
      entries.push({
        url: `${BASE_URL}/countries/${id}`,
        lastModified: lastMod,
        changeFrequency: "weekly",
        priority: country.overall_risk_tier === "HIGH" ? 0.7 : 0.5,
      });

      const slug = countrySlug(country.name);
      if (!slug) continue;

      // /signals/{country-slug} — country-rolled-up watchlist.
      entries.push({
        url: `${BASE_URL}/signals/${slug}`,
        lastModified: lastMod,
        changeFrequency: "weekly",
        priority: country.overall_risk_tier === "HIGH" ? 0.7 : 0.5,
      });

      // /signals/{country-slug}/{cat} — top categories per country
      // (replaces the old /countries/{id}/{cat} entries).
      const seenCats = new Set<string>();
      for (const tier of Object.values(country.tiers)) {
        for (const cat of tier.top_categories.slice(0, 3)) {
          if (seenCats.has(cat.category)) continue;
          seenCats.add(cat.category);
          entries.push({
            url: `${BASE_URL}/signals/${slug}/${cat.category}`,
            lastModified: lastMod,
            changeFrequency: "weekly",
            priority: 0.4,
          });
        }
      }
    }
  } catch {
    // If country-risks.json is unreachable at build time, ship just the
    // static routes rather than failing the sitemap entirely.
  }

  return entries;
}
