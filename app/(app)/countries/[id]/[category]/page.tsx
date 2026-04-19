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
      canonicalLength={enriched.canonicalLength}
      enrichmentOriginalCount={enriched.originalCount}
      enrichmentDroppedCount={enriched.droppedCount}
    />
  );
}
