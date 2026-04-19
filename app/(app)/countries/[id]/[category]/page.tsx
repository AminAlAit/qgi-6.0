import { getCountryRisk, loadCountryRisks } from "@/lib/country-risks";
import { PrecedentDetailClient } from "@/components/countries/PrecedentDetailClient";
import type { Metadata } from "next";
import type {
  AnaloguesEnrichedPayload,
  AnalogueEnrichedEntry,
  AnalogueEnrichedSubject,
} from "@/lib/types";

interface Props {
  params: Promise<{ id: string; category: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, category } = await params;
  const country = await getCountryRisk(id);
  const name = country?.name ?? `Country #${id}`;
  const catLabel = category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
 * Load enriched analogues (with per-analogue event years) from analogues-enriched.json.
 * Produced by `.tmp/decisions-form/_enrich_analogues.py` against `qgi-data/events/curated/`.
 * Feeds the AnalogueMultiTimeline widget (ticket #293).
 */
async function loadEnrichedAnalogues(
  countryId: string,
  category: string
): Promise<{
  subject: AnalogueEnrichedSubject | null;
  analogues: AnalogueEnrichedEntry[];
}> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "analogues-enriched.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const payload = JSON.parse(raw) as AnaloguesEnrichedPayload;
    const entry = payload.countries?.[countryId]?.[category];
    if (!entry) return { subject: null, analogues: [] };
    return { subject: entry.subject, analogues: entry.analogues };
  } catch {
    return { subject: null, analogues: [] };
  }
}

export default async function PrecedentDetailPage({ params }: Props) {
  const { id, category } = await params;
  const country = await getCountryRisk(id);

  if (!country) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--qgi-text-muted)" }}>Country not found.</p>
      </div>
    );
  }

  let data;
  try {
    data = await loadCountryRisks();
  } catch {
    data = null;
  }

  const decodedCategory = decodeURIComponent(category);
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
    />
  );
}
