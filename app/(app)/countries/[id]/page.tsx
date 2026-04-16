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
    const key = countryName.toLowerCase().replace(/\s+/g, "_");
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
    const slug = countryName.toLowerCase().replace(/\s+/g, "_");
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

  return (
    <CountryProfileClient
      countryId={id}
      country={country}
      generatedAt={data?.generated_at ?? null}
      version={data?.version ?? "unknown"}
      events={events}
      l1Scores={salience?.l1Scores ?? null}
      l2Scores={salience?.l2Scores ?? null}
    />
  );
}
