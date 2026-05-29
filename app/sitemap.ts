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
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { countrySlug } from "@/lib/slug";

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
  // V3 canonical family pages — public-facing landing surfaces.
  // PR-iii (2026-05-15): these URLs now serve the V3 (formerly -merged)
  // shells. Legacy V1 lives at `-v1` and is `Disallow`'d in robots.ts.
  //
  // NOTE: /dashboard intentionally NOT listed — current dashboard still
  // carries `robots: { index: false }` (transitional state until PR-vi
  // redesigns it as QGI's landing page). When PR-vi flips it to
  // indexable, add `{ path: "/dashboard", changeFrequency: "weekly", priority: 0.95 }`.
  // V4.1 canonical family pages (promoted 2026-05-28).
  // /signals and /precedents are deleted; /recipes, /countries, /patterns
  // are now V4.1 canonical. /risk-board, /compare, /compound-risk,
  // /nearest-analog are new surfaces added in the V4.1 promo.
  { path: "/dashboard", changeFrequency: "daily", priority: 0.95 },
  { path: "/recipes", changeFrequency: "weekly", priority: 0.9 },
  { path: "/countries", changeFrequency: "daily", priority: 0.9 },
  { path: "/patterns", changeFrequency: "weekly", priority: 0.7 },
  { path: "/risk-board", changeFrequency: "daily", priority: 0.8 },
  { path: "/compound-risk", changeFrequency: "weekly", priority: 0.7 },
  { path: "/compare", changeFrequency: "weekly", priority: 0.6 },
  { path: "/nearest-analog", changeFrequency: "weekly", priority: 0.6 },
  // /recipe-tracker route deleted 2026-05-29 — folded into /recipes via
  // the per-card Confidence badge. The blog post at /blog/recipe-tracker
  // is unaffected (separate route, audience-facing program update).
  { path: "/methodology", changeFrequency: "monthly", priority: 0.8 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.6 },
  // Recipe Tracker: continuously updated as recipes graduate or enter validation.
  {
    path: "/blog/recipe-tracker",
    changeFrequency: "weekly",
    priority: 0.7,
  },
  // Ghana piece moved to /reports (2026-05-19); /blog/ghana-mauritania-mirror
  // 301-redirects via next.config.ts. Removed from sitemap to avoid
  // surfacing a redirecting URL.
  {
    path: "/blog/foreign-intervention-graduation",
    changeFrequency: "monthly",
    priority: 0.65,
  },
  {
    path: "/blog/burkina-faso-mali-car-precedent",
    changeFrequency: "monthly",
    priority: 0.5,
  },
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
  // R8 podium pieces, published 2026-05-21.
  {
    path: "/reports/niger-burkina-divergence",
    changeFrequency: "monthly",
    priority: 0.65,
  },
  {
    path: "/reports/india-pakistan-mirror",
    changeFrequency: "monthly",
    priority: 0.65,
  },
  {
    path: "/reports/ukraine-bosnia-mirror",
    changeFrequency: "monthly",
    priority: 0.65,
  },
  // Ghana country analysis elevated from /blog (2026-05-19).
  {
    path: "/reports/ghana-mauritania-mirror",
    changeFrequency: "monthly",
    priority: 0.6,
  },
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

  // Single load of ml-recipe-stack.json, reused by both the /precedents
  // emission below and the /signals leaf-URL emission further down.
  // Sonnet PR #123 F2 — prior version of this file fetched the stack
  // twice serially; in-process cache made it cheap but the duplicate
  // was misleading.
  const mlStack = await loadMlRecipeStack().catch(() => null);
  const lockedRecipeSet = new Set(mlStack?.metadata.top_4_recipes ?? []);

  // #464: V2.0 canonical URLs.
  //   /precedents/{slug}                — Recipe (one per LOCKed ML recipe)
  //   /signals/{country-slug}           — country-rolled-up watchlist
  //   /signals/{country-slug}/{slug}    — country-vs-recipe leaf
  //   /countries/{id}                   — country profile (unchanged)
  //   /countries/{id}/{cat}             — DROPPED (301 to /signals/...)
  //
  // #748 PR-3 (2026-05-17) — `/precedents/{slug}` now emits ONLY the 4
  // LOCKed ML slugs per the founder's L10525 directive ("All other
  // recipes/precedents, other than those 4 must be removed from view").
  // The other ~86 retired slugs 301-redirect to `/precedents` via
  // `next.config.ts RETIRED_PRECEDENT_SLUGS`. Emitting them in the
  // sitemap would invite Google to surface URLs that redirect — bad
  // for crawl budget + indexed-URL hygiene.
  if (mlStack) {
    for (const slug of mlStack.metadata.top_4_recipes) {
      entries.push({
        url: `${BASE_URL}/precedents/${slug}`,
        lastModified: now,
        changeFrequency: "weekly",
        // Higher priority than the previous 0.6 across 71 entries —
        // these are the only validated precedents, deserve more
        // crawl-budget weight.
        priority: 0.8,
      });
    }
  }
  // If ml-recipe-stack.json was unreachable at build time, ship the
  // sitemap without the precedent slugs rather than failing entirely.

  // Country-profile + signals routes.
  try {
    const data = await loadCountryRisks();
    const lastMod = data.generated_at ? new Date(data.generated_at) : now;
    // #815 (2026-05-18) — /signals graduation: only emit leaf URLs for
    // the 4 LOCKed recipes. Same rationale as the /precedents sitemap
    // trim (#748 PR-3) — non-LOCKed leaves are reachable via direct URL
    // but unsurfaced from the /signals index, so emitting them in the
    // sitemap would invite Google to surface URLs that aren't part of
    // the validated-recipe product surface. Reuses the `lockedRecipeSet`
    // hoisted above. When mlStack failed to load, the set is empty and
    // no leaf URLs emit (still ships parent /signals/{country} routes).
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

      // /signals/{country-slug}/{cat} — only the 4 LOCKed recipes per
      // #815 graduation. Pre-graduation this emitted top-3 categories
      // per country across all tier windows (~2-3K leaves total).
      const seenCats = new Set<string>();
      for (const tier of Object.values(country.tiers)) {
        for (const cat of tier.top_categories.slice(0, 3)) {
          if (!lockedRecipeSet.has(cat.category)) continue;
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
