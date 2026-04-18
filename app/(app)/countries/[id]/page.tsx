import { getCountryRisk, loadCountryRisks } from "@/lib/country-risks";
import { CountryProfileClient } from "@/components/countries/CountryProfileClient";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const country = await getCountryRisk(id);
  const name = country?.name ?? `Country #${id}`;
  return {
    title: `${name} — QGI Intelligence`,
    description: `Risk intelligence profile for ${name} based on historical precedent analysis.`,
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
    const key = countryName.toLowerCase().replace(/^the\s+/, "").replace(/\bof the\b/g, "of").replace(/[-\s]+/g, "_").replace(/[^a-z0-9_]/g, "");
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
async function loadCountrySalience(
  countryName: string
): Promise<{ l1Scores: Record<string, number>; l2Scores: Record<string, number> } | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const slug = countryName.toLowerCase().replace(/^the\s+/, "").replace(/\bof the\b/g, "of").replace(/[-\s]+/g, "_").replace(/[^a-z0-9_]/g, "");
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
async function loadStructuralTwins(
  countryId: string
): Promise<Array<{ partner_id: number; partner_name: string; alpha2: string; pattern_count: number; mean_corr: number; best_pps: number }>> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "structural-twins.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const allTwins = JSON.parse(raw) as Record<string, Array<{
      partner_id: number; partner_name: string; alpha2: string;
      pattern_count: number; mean_corr: number; best_pps: number;
    }>>;
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
): Promise<Record<string, Array<{ country_b_id: number; country_b_name: string; alpha2: string; recipe_count: number; mean_corr: number; best_pps: number; avg_lead_years: number | null }>>> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "analogues.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const all = JSON.parse(raw) as Record<string, Record<string, Array<{
      country_b_id: number; country_b_name: string; alpha2: string;
      recipe_count: number; mean_corr: number; best_pps: number; avg_lead_years: number | null;
    }>>>;
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
    const all = JSON.parse(raw) as Record<string, { years: number[]; counts: number[]; total: number }>;
    return all[countryId] ?? null;
  } catch {
    return null;
  }
}

/**
 * Load indicator trajectories from baked data/indicator-trajectories.json (GH#287).
 * Returns null if the file doesn't exist or this country has no data.
 */
async function loadIndicatorTrajectories(
  countryId: string
): Promise<{
  years: number[];
  indicators: { name: string; unit: string; data: (number | null)[]; predicted_from?: number }[];
  events: { year: number; label: string }[];
} | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "indicator-trajectories.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const all = JSON.parse(raw) as Record<string, {
      years: number[];
      indicators: { name: string; unit: string; data: (number | null)[]; predicted_from?: number }[];
      events: { year: number; label: string }[];
    }>;
    return all[countryId] ?? null;
  } catch {
    return null;
  }
}

export default async function CountryProfilePage({ params }: Props) {
  const { id } = await params;
  const country = await getCountryRisk(id);

  if (!country) {
    return (
      <div className="p-8">
        <h1
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Country Not Found
        </h1>
        <p style={{ color: "var(--qgi-text-muted)" }}>
          No risk data available for country ID {id}.
        </p>
      </div>
    );
  }

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
