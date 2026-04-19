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
  { path: "/reports", changeFrequency: "monthly", priority: 0.6 },
  { path: "/reports/fsi-qgi-report", changeFrequency: "monthly", priority: 0.6 },
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

  // Country-profile + per-category drill-downs.
  try {
    const data = await loadCountryRisks();
    const lastMod = data.generated_at ? new Date(data.generated_at) : now;
    for (const [id, country] of Object.entries(data.countries)) {
      entries.push({
        url: `${BASE_URL}/countries/${id}`,
        lastModified: lastMod,
        changeFrequency: "weekly",
        priority: country.overall_risk_tier === "HIGH" ? 0.7 : 0.5,
      });
      // Surface top categories per country so search engines can reach
      // the precedent-detail pages directly.
      const seenCats = new Set<string>();
      for (const tier of Object.values(country.tiers)) {
        for (const cat of tier.top_categories.slice(0, 3)) {
          if (seenCats.has(cat.category)) continue;
          seenCats.add(cat.category);
          entries.push({
            url: `${BASE_URL}/countries/${id}/${cat.category}`,
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
