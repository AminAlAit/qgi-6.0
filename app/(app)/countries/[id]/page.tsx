import { getCountryRisk, loadCountryRisks } from "@/lib/country-risks";
import { CountryProfileClient } from "@/components/countries/CountryProfileClient";
import { countrySlug } from "@/lib/slug";
import { TOTAL_COUNTRIES } from "@/lib/site-stats";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

// T16 #309 HIGH fix: country profiles re-read ~7 baked JSONs on every
// request. Revalidate hourly (matches the cadence of the pipeline run)
// so serverless cold-starts don't re-parse megabytes per request.
export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * #426: Resolve a non-numeric `id` (e.g. "syria", "SY", "cape-verde") to
 * the numeric country ID by checking alpha_2 codes then name slugs. Returns
 * null when nothing matches so the caller can issue a 404.
 *
 * Case-insensitive; accepts hyphenated slugs like "cape-verde" alongside
 * underscore-canonical form "cape_verde".
 */
async function resolveIdOrSlug(id: string): Promise<string | null> {
  // Fast path: already numeric → return as-is (validity is checked by
  // the caller via getCountryRisk).
  if (/^\d+$/.test(id)) return id;

  const data = await loadCountryRisks().catch(() => null);
  if (!data?.countries) return null;

  const needle = id.toLowerCase().replace(/-/g, "_");

  // Try alpha_2 first (short + cheap).
  for (const [cid, c] of Object.entries(data.countries)) {
    if (c.alpha_2?.toLowerCase() === needle) return cid;
  }

  // Fall back to name slug.
  for (const [cid, c] of Object.entries(data.countries)) {
    if (countrySlug(c.name) === needle) return cid;
  }

  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = (await resolveIdOrSlug(rawId)) ?? rawId;
  const country = await getCountryRisk(id);
  // #452: an unresolved slug (e.g. /countries/zzznonexistent or
  // /countries/cape-verde when Cape Verde isn't in the V1.9.1 89-country
  // dataset) used to render a head title of "Country #zzznonexistent —
  // QGI Intelligence" — slug literally reflected into the title. The
  // body fix in #426 didn't cover the metadata path. Return a generic
  // not-found title + noindex so search engines don't index the
  // not-found page under the slug-shaped URL.
  if (!country) {
    return {
      title: "Page not found — QGI Intelligence",
      robots: { index: false, follow: false },
    };
  }
  const name = country.name;
  const description = `Risk intelligence profile for ${name}: structural indicator analysis, historical precedents, and analogues from ${TOTAL_COUNTRIES} countries of World Bank data.`;
  const canonical = `https://qgintelligence.com/countries/${id}`;
  // T19 #312: per-page openGraph + twitter + canonical so country profiles
  // are share-worthy and indexable as distinct pages (prior metadata only
  // had title + description, so every country shared the root OG card).
  return {
    title: `${name} — QGI Intelligence`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${name} — QGI Intelligence`,
      description,
      url: canonical,
      siteName: "QGI Intelligence",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — QGI Intelligence`,
      description,
    },
  };
}

/**
 * Load curated events for a country by matching country name to filename.
 */
async function loadCountryEvents(
  countryName: string
): Promise<Array<{ year: number; title: string; category: string }>> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "country-events.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const allEvents = JSON.parse(raw) as Record<
      string,
      Array<{ year: number; title: string; category: string }>
    >;
    // Match by snake_case country name
    const key = countryName
      .toLowerCase()
      .replace(/^the\s+/, "")
      .replace(/\bof the\b/g, "of")
      .replace(/[-\s]+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    return allEvents[key] ?? [];
  } catch {
    return [];
  }
}

/**
 * Load layered-taxonomy salience scores from data/salience/{slug}.json.
 * Stage A wiring per ticket #233 — these are precomputed by the standalone
 * salience module in qgi-ml/scripts/salience/.
 * Returns null if no salience file exists for this country yet.
 */
async function loadCountrySalience(countryName: string): Promise<{
  l1Scores: Record<string, number>;
  l2Scores: Record<string, number>;
} | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const slug = countryName
      .toLowerCase()
      .replace(/^the\s+/, "")
      .replace(/\bof the\b/g, "of")
      .replace(/[-\s]+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    const filePath = path.join(process.cwd(), "data", "salience", `${slug}.json`);
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as {
      l1_scores: Record<string, number>;
      l2_scores: Record<string, number>;
    };
    return { l1Scores: data.l1_scores, l2Scores: data.l2_scores };
  } catch {
    return null;
  }
}

/**
 * Load structural twins from baked data/structural-twins.json.
 */
async function loadStructuralTwins(countryId: string): Promise<
  Array<{
    partner_id: number;
    partner_name: string;
    alpha2: string;
    pattern_count: number;
    mean_corr: number;
    best_pps: number;
  }>
> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "structural-twins.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const allTwins = JSON.parse(raw) as Record<
      string,
      Array<{
        partner_id: number;
        partner_name: string;
        alpha2: string;
        pattern_count: number;
        mean_corr: number;
        best_pps: number;
      }>
    >;
    return allTwins[countryId] ?? [];
  } catch {
    return [];
  }
}

/**
 * Load analogues from baked data/analogues.json (GH#282).
 */
async function loadAnalogues(
  countryId: string,
  category?: string
): Promise<
  Record<
    string,
    Array<{
      country_b_id: number;
      country_b_name: string;
      alpha2: string;
      recipe_count: number;
      mean_corr: number;
      best_pps: number;
      avg_lead_years: number | null;
    }>
  >
> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "analogues.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const all = JSON.parse(raw) as Record<
      string,
      Record<
        string,
        Array<{
          country_b_id: number;
          country_b_name: string;
          alpha2: string;
          recipe_count: number;
          mean_corr: number;
          best_pps: number;
          avg_lead_years: number | null;
        }>
      >
    >;
    const countryAnalogues = all[countryId] ?? {};
    if (category) {
      const filtered: typeof countryAnalogues = {};
      if (countryAnalogues[category]) filtered[category] = countryAnalogues[category];
      return filtered;
    }
    return countryAnalogues;
  } catch {
    return {};
  }
}

/**
 * Load pattern density from baked data/pattern-density.json.
 */
async function loadPatternDensity(
  countryId: string
): Promise<{ years: number[]; counts: number[]; total: number } | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "pattern-density.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const all = JSON.parse(raw) as Record<
      string,
      { years: number[]; counts: number[]; total: number }
    >;
    return all[countryId] ?? null;
  } catch {
    return null;
  }
}

/**
 * Load indicator trajectories from baked data/indicator-trajectories.json (GH#287).
 * Returns null if the file doesn't exist or this country has no data.
 */
async function loadIndicatorTrajectories(countryId: string): Promise<{
  years: number[];
  indicators: {
    name: string;
    unit: string;
    data: (number | null)[];
    predicted_from?: number;
  }[];
  events: { year: number; label: string }[];
} | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "indicator-trajectories.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const all = JSON.parse(raw) as Record<
      string,
      {
        years: number[];
        indicators: {
          name: string;
          unit: string;
          data: (number | null)[];
          predicted_from?: number;
        }[];
        events: { year: number; label: string }[];
      }
    >;
    return all[countryId] ?? null;
  } catch {
    return null;
  }
}

export default async function CountryProfilePage({ params }: Props) {
  const { id: rawId } = await params;

  // #426: if id is non-numeric, try slug/alpha_2 resolution → redirect to
  // the canonical numeric URL. If nothing matches, return a proper 404
  // (not a soft-404 that echoes user input into the page title).
  if (!/^\d+$/.test(rawId)) {
    const resolved = await resolveIdOrSlug(rawId);
    if (resolved) redirect(`/countries/${resolved}`);
    notFound();
  }

  const id = rawId;
  const country = await getCountryRisk(id);

  if (!country) notFound();

  let data;
  try {
    data = await loadCountryRisks();
  } catch {
    data = null;
  }

  const events = await loadCountryEvents(country.name);
  const salience = await loadCountrySalience(country.name);
  const twins = await loadStructuralTwins(id);
  const densityData = await loadPatternDensity(id);
  const trajectoryData = await loadIndicatorTrajectories(id);

  return (
    <CountryProfileClient
      countryId={id}
      country={country}
      generatedAt={data?.generated_at ?? null}
      version={data?.version ?? "unknown"}
      events={events}
      l1Scores={salience?.l1Scores ?? null}
      l2Scores={salience?.l2Scores ?? null}
      twins={twins}
      densityData={densityData}
      trajectoryData={trajectoryData}
    />
  );
}
