import { getCountryRisk, loadCountryRisks } from "@/lib/country-risks";
import { PrecedentDetailClient } from "@/components/countries/PrecedentDetailClient";
import { CATEGORY_L1_MAP } from "@/lib/category-taxonomy";
import { countrySlug } from "@/lib/slug";
import { signalCountryRecipeUrl } from "@/lib/recipes-aggregated";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type {
  AnaloguesEnrichedPayload,
  AnalogueEnrichedEntry,
  AnalogueEnrichedSubject,
} from "@/lib/types";

/**
 * #426: validate the `[category]` URL param against (a) the country's
 * actual scored categories and (b) the canonical 71-code L3 taxonomy.
 *
 * Without this check, `/countries/217/made_up_thing` silently renders a
 * fabricated page with a HIGH-looking tier badge and zero-value tiles.
 */
function isValidCategory(
  country: { tiers: Record<string, { top_categories: Array<{ category: string }> }> },
  category: string
): boolean {
  // First check: is it in the country's actual scored categories? (Fast + strict.)
  for (const tier of Object.values(country.tiers ?? {})) {
    for (const cat of tier.top_categories ?? []) {
      if (cat.category === category) return true;
    }
  }
  // Second check: is it a known L3 taxonomy code? (A valid category the
  // country just doesn't happen to have a top signal for — still a real
  // URL, render the empty state rather than 404.)
  if (category in CATEGORY_L1_MAP) return true;
  return false;
}

interface Props {
  params: Promise<{ id: string; category: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, category } = await params;
  // #452: validate the category at metadata-generation time too. Without
  // this guard, /countries/217/made_up_thing renders the not-found body
  // BUT the head title still reads "Syria — Made Up Thing — QGI
  // Intelligence" (because generateMetadata runs before the route
  // handler's notFound()). The fabricated title is a real-but-subtle
  // SEO + share-card bug that the body fix didn't catch.
  const country = await getCountryRisk(id);
  const decodedCategory = decodeURIComponent(category);
  if (!country || !isValidCategory(country, decodedCategory)) {
    return {
      title: "Page not found — QGI Intelligence",
      robots: { index: false, follow: false },
    };
  }
  const name = country.name;
  const catLabel = decodedCategory
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const description = `Precedent analysis for ${catLabel} risk in ${name}. Historical analogues, pattern-length tier breakdown, and evidence from QGI Intelligence.`;
  const canonical = `https://qgintelligence.com/countries/${id}/${category}`;
  // T19 #312: per-page OG + canonical so each precedent detail page has
  // its own social preview (the right unit of shareability for analysts).
  return {
    title: `${name} — ${catLabel} — QGI Intelligence`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${name} — ${catLabel}`,
      description,
      url: canonical,
      siteName: "QGI Intelligence",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — ${catLabel}`,
      description,
    },
  };
}

type LegacyAnalogue = {
  country_b_id: number;
  country_b_name: string;
  alpha2: string;
  recipe_count: number;
  mean_corr: number;
  best_pps: number;
  avg_lead_years: number | null;
};

/**
 * Load analogues for a specific country-category from baked analogues.json (legacy).
 */
async function loadAnalogues(
  countryId: string,
  category: string
): Promise<LegacyAnalogue[]> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "analogues.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const all = JSON.parse(raw) as Record<string, Record<string, LegacyAnalogue[]>>;
    return all[countryId]?.[category] ?? [];
  } catch {
    return [];
  }
}

/**
 * Load enriched analogues (with per-analogue event years + length-L pair
 * windows) from analogues-enriched.json.
 *
 * Data pipeline (as of 2026-04-19, #354):
 *   1. `_enrich_analogues.py` — picks median-year signature events from
 *      qgi-data/events/curated/ and attaches event_year_b per analogue.
 *   2. `enrich_analogues_common_length.py` — picks canonical length L
 *      per (subject, category), selects each analogue's best-PPS
 *      length-L window, attaches pair_length + pair_start_a/b,
 *      event_in_window flag, drops analogues without an L-window.
 *
 * Consumed by AnalogueMultiTimeline (tickets #293, #354).
 */
async function loadEnrichedAnalogues(
  countryId: string,
  category: string
): Promise<{
  subject: AnalogueEnrichedSubject | null;
  analogues: AnalogueEnrichedEntry[];
  canonicalLength: number | undefined;
  originalCount: number | undefined;
  droppedCount: number;
}> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "analogues-enriched.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const payload = JSON.parse(raw) as AnaloguesEnrichedPayload;
    const entry = payload.countries?.[countryId]?.[category];
    if (!entry) {
      return {
        subject: null,
        analogues: [],
        canonicalLength: undefined,
        originalCount: undefined,
        droppedCount: 0,
      };
    }
    // #354: the enrichment script drops analogues with no length-L window
    // but doesn't record the drop count in-place. Approximate it by
    // comparing against the legacy analogues.json (same (subject,
    // category), pre-length-L) — if the legacy file has more entries
    // than the enriched one, the diff is the dropped count.
    let originalCount: number | undefined;
    let droppedCount = 0;
    try {
      const legacyPath = path.join(process.cwd(), "data", "analogues.json");
      const legacyRaw = await fs.readFile(legacyPath, "utf-8");
      const legacy = JSON.parse(legacyRaw) as Record<string, Record<string, unknown[]>>;
      const legacyList = legacy[countryId]?.[category];
      if (Array.isArray(legacyList)) {
        originalCount = legacyList.length;
        droppedCount = Math.max(0, legacyList.length - entry.analogues.length);
      }
    } catch {
      // analogues.json missing or malformed — skip the drop-count footnote
    }
    return {
      subject: entry.subject,
      analogues: entry.analogues,
      canonicalLength: entry.canonical_length,
      originalCount,
      droppedCount,
    };
  } catch {
    return {
      subject: null,
      analogues: [],
      canonicalLength: undefined,
      originalCount: undefined,
      droppedCount: 0,
    };
  }
}

export default async function PrecedentDetailPage({ params }: Props) {
  const { id, category } = await params;

  // #426: non-numeric id should never reach this route because the parent
  // [id] route redirects or 404s first. Defensive: if someone crafts a
  // direct URL like /countries/syria/civil_war_and_insurgency, 404.
  if (!/^\d+$/.test(id)) notFound();

  const country = await getCountryRisk(id);
  if (!country) notFound();

  const decodedCategory = decodeURIComponent(category);

  // #426: validate category before rendering anything. Blocks the
  // confabulation vector where /countries/217/<anything> silently
  // produces a HIGH-tier-badged page with auto-generated copy.
  if (!isValidCategory(country, decodedCategory)) notFound();

  // #464: this URL is deprecated. Permanent-redirect to the canonical
  // V2.0 path /signals/{country-slug}/{category}. Preserves all inbound
  // links from email digests, blog posts, social shares, and the
  // 50+ /countries/{id}/{cat} URLs already in the sitemap.
  //
  // Why redirect instead of dual-rendering: the new /signals/{country}/{slug}
  // page (when wired to real data in Week 3 via #463) will render
  // similarity-score-first with the analogue panel as evidence. The old
  // /countries/{id}/{cat} page is density-first. Two surfaces mean two
  // mental models for the same data — the Majles consult Decision 4
  // (11-0) was explicit that signals + countries should be distinct
  // products, with country/category drilldowns living under signals.
  const slug = countrySlug(country.name);
  if (slug) {
    redirect(signalCountryRecipeUrl(slug, decodedCategory));
  }
  // Fallback: if slug resolution somehow fails, render the old page so
  // we don't 404 a previously-working URL. Should be unreachable in
  // practice — every country in country-risks.json has a slug-able name.

  let data;
  try {
    data = await loadCountryRisks();
  } catch {
    data = null;
  }

  const analogues = await loadAnalogues(id, decodedCategory);
  const enriched = await loadEnrichedAnalogues(id, decodedCategory);

  return (
    <PrecedentDetailClient
      countryId={id}
      country={country}
      category={decodedCategory}
      generatedAt={data?.generated_at ?? null}
      version={data?.version ?? "unknown"}
      analogues={analogues}
      enrichedSubject={enriched.subject}
      enrichedAnalogues={enriched.analogues}
      canonicalLength={enriched.canonicalLength}
      enrichmentOriginalCount={enriched.originalCount}
      enrichmentDroppedCount={enriched.droppedCount}
    />
  );
}
