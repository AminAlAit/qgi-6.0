"use client";

/**
 * BASE — QGI Command Center (redesign 2026-04-17).
 *
 * 5-zone vertical stack:
 *  Zone 1: Status Bar (40px, persistent context)
 *  Zone 2: Situation Summary (Featured Alert + Risk Pulse)
 *  Zone 3: Intelligence Grid (Watchlist + Outliers)
 *  Zone 4: Signal Landscape (Domain Heatmap + Top Convergences + Top Pattern Pairs)
 *  Zone 5: Data Foundation (collapsed by default)
 *
 * Design doc: qgi-docs/internal/design/ux-redesign-base-2026-04-17.md
 */
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { CountryFlag } from "@/components/design/CountryFlag";
import { InfoTooltip } from "@/components/design/InfoTooltip";
import type { IndexEntry, PatternRow, SignalRow } from "@/lib/types";
import type { CountryRisksData, RiskTier } from "@/lib/country-risks";
import { CONVERGENCE_COLORS, CONVERGENCE_LABELS } from "@/lib/design";
import { TOTAL_COUNTRIES, UN_STATES } from "@/lib/site-stats";

const SectorRose = dynamic(
  () => import("@/components/charts/SectorRose").then((m) => m.SectorRose),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaxonomyL2 {
  id: string;
  label: string;
  definition: string;
  layer3: string[];
}

interface TaxonomyL1 {
  id: string;
  label: string;
  display_label: string;
  definition: string;
  color_hint: string;
  layer2: TaxonomyL2[];
}

interface TaxonomyData {
  version: string;
  generated: string;
  summary: { layer1_count: number; layer2_count: number; layer3_count: number };
  layer1: TaxonomyL1[];
}

interface Props {
  risks: CountryRisksData | null;
  indexes: IndexEntry[];
  topPairs: PatternRow[];
  totalUniquePairs: number;
  topSignals: SignalRow[];
  taxonomy: TaxonomyData;
  // PR-vi (2026-05-15) — Majles-verdict props for the four-family band.
  signalsHighCount: number;
  signalsModerateCount: number;
  signalsTotalCount: number;
  mlValidatedCount: number;
  totalLocked: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<RiskTier, { bg: string; text: string; border: string }> = {
  HIGH: {
    bg: "rgba(248, 113, 113, 0.12)",
    text: "#f87171",
    border: "#f87171",
  },
  MODERATE: {
    bg: "rgba(251, 191, 36, 0.12)",
    text: "var(--qgi-amber)",
    border: "var(--qgi-amber)",
  },
  INDICATIVE: {
    bg: "rgba(56, 189, 248, 0.12)",
    text: "#38bdf8",
    border: "#38bdf8",
  },
};

/** Country ID -> UN region code. Lightweight static lookup. */
const REGION_MAP: Record<string, string> = (() => {
  // Map numeric WB country_id -> region abbreviation
  // SSA = Sub-Saharan Africa, MNA = Middle East & North Africa,
  // EAP = East Asia & Pacific, SAS = South Asia, LAC = Latin America & Caribbean,
  // ECA = Europe & Central Asia
  const map: Record<string, string> = {};
  // SSA (excluding North Africa: 12=Algeria, 434=Libya, 504=Morocco → MNA)
  for (const id of [
    "24",
    "72",
    "854",
    "108",
    "120",
    "132",
    "140",
    "148",
    "174",
    "178",
    "180",
    "204",
    "226",
    "231",
    "232",
    "266",
    "270",
    "288",
    "324",
    "624",
    "384",
    "404",
    "426",
    "430",
    "450",
    "454",
    "466",
    "478",
    "480",
    "508",
    "516",
    "562",
    "566",
    "646",
    "678",
    "686",
    "694",
    "706",
    "710",
    "716",
    "728",
    "729",
    "748",
    "768",
    "800",
    "834",
    "894",
  ])
    map[id] = "SSA";
  // MNA
  for (const id of [
    "12",
    "48",
    "262",
    "818",
    "364",
    "368",
    "376",
    "400",
    "414",
    "422",
    "434",
    "504",
    "512",
    "275",
    "634",
    "682",
    "760",
    "788",
    "792",
    "784",
    "887",
  ])
    map[id] = "MNA";
  // EAP
  for (const id of [
    "36",
    "96",
    "116",
    "156",
    "242",
    "296",
    "360",
    "392",
    "408",
    "410",
    "418",
    "458",
    "496",
    "104",
    "540",
    "554",
    "598",
    "608",
    "882",
    "626",
    "764",
    "776",
    "798",
    "548",
  ])
    map[id] = "EAP";
  // SAS
  for (const id of ["4", "50", "64", "356", "144", "462", "524", "586"]) map[id] = "SAS";
  // LAC
  for (const id of [
    "28",
    "32",
    "44",
    "52",
    "68",
    "76",
    "84",
    "152",
    "170",
    "188",
    "192",
    "212",
    "214",
    "218",
    "222",
    "308",
    "320",
    "328",
    "332",
    "340",
    "388",
    "484",
    "558",
    "591",
    "600",
    "604",
    "662",
    "740",
    "780",
    "858",
    "862",
  ])
    map[id] = "LAC";
  // ECA
  for (const id of [
    "8",
    "40",
    "51",
    "56",
    "70",
    "100",
    "191",
    "196",
    "203",
    "208",
    "233",
    "246",
    "250",
    "268",
    "276",
    "300",
    "348",
    "352",
    "372",
    "380",
    "398",
    "417",
    "428",
    "440",
    "442",
    "807",
    "498",
    "499",
    "528",
    "578",
    "616",
    "620",
    "642",
    "643",
    "688",
    "703",
    "705",
    "724",
    "752",
    "756",
    "804",
    "826",
    "860",
  ])
    map[id] = "ECA";
  return map;
})();

const REGION_LABELS: Record<string, string> = {
  SSA: "Sub-Saharan Africa",
  MNA: "Middle East & N. Africa",
  EAP: "East Asia & Pacific",
  SAS: "South Asia",
  LAC: "Latin America & Caribbean",
  ECA: "Europe & Central Asia",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BaseClient({
  risks,
  indexes,
  topPairs,
  totalUniquePairs,
  topSignals,
  taxonomy,
  // PR-vi — Majles-verdict props
  signalsHighCount,
  signalsModerateCount,
  signalsTotalCount,
  mlValidatedCount,
  totalLocked,
}: Props) {
  const router = useRouter();
  const [dataFoundationOpen, setDataFoundationOpen] = useState(false);

  // ── Derive hero metrics ─────────────────────────────────────────
  const stats = useMemo(() => {
    if (!risks) {
      return {
        total: 0,
        curated: 0,
        high: 0,
        moderate: 0,
        indicative: 0,
        version: "---",
        generatedAt: null as string | null,
      };
    }
    const counts = { HIGH: 0, MODERATE: 0, INDICATIVE: 0 } as Record<RiskTier, number>;
    for (const c of Object.values(risks.countries)) {
      counts[c.overall_risk_tier] = (counts[c.overall_risk_tier] ?? 0) + 1;
    }
    return {
      total: risks.total_countries ?? Object.keys(risks.countries).length,
      curated: risks.curated_country_count ?? 0,
      high: counts.HIGH,
      moderate: counts.MODERATE,
      indicative: counts.INDICATIVE,
      version: risks.version ?? "---",
      generatedAt: risks.generated_at ?? null,
    };
  }, [risks]);

  // ── Top 10 high-risk countries by salience ──────────────────────
  const topCountries = useMemo(() => {
    if (!risks) return [];
    const rows: Array<{
      id: string;
      name: string;
      alpha_2: string;
      tier: RiskTier;
      topCategories: string[];
      topSalience: number;
      curated: boolean;
      recipeCount: number;
    }> = [];
    for (const [id, country] of Object.entries(risks.countries)) {
      if (country.overall_risk_tier !== "HIGH") continue;
      const cats = country.tiers?.S?.top_categories ?? [];
      const top = cats[0];
      const salience = top ? (top.salience_score ?? top.z_score ?? 0) : 0;
      rows.push({
        id,
        name: country.name,
        alpha_2: country.alpha_2,
        tier: country.overall_risk_tier,
        topCategories: cats.slice(0, 2).map((c) => c.category),
        topSalience: salience,
        curated: country.curated,
        recipeCount: top?.recipe_count ?? 0,
      });
    }
    return rows.sort((a, b) => b.topSalience - a.topSalience).slice(0, 10);
  }, [risks]);

  // ── Featured alert (highest salience curated country) ───────────
  const featuredAlert = useMemo(() => {
    if (!risks) return null;
    let best: {
      id: string;
      name: string;
      alpha_2: string;
      tier: RiskTier;
      topCategory: string;
      salience: number;
      recipeCount: number;
      nPredictors: number;
      narrative: string;
    } | null = null;
    let bestSalience = -Infinity;

    for (const [id, country] of Object.entries(risks.countries)) {
      if (!country.curated) continue;
      const cats = country.tiers?.S?.top_categories ?? [];
      const top = cats[0];
      if (!top) continue;
      const salience = top.salience_score ?? top.z_score ?? 0;
      if (salience > bestSalience) {
        bestSalience = salience;
        // Check for convergence signals on this country
        const signal = topSignals.find(
          (s) => String(s.country_a_id) === id && (s.n_predictors ?? 0) >= 2
        );
        const nPred = signal?.n_predictors ?? 0;
        const category = formatCategory(top.category);
        const narrative =
          nPred >= 2
            ? `${nPred} independent predictor countries converge on a ${category.toLowerCase()} trajectory.`
            : `${top.recipe_count.toLocaleString()} precedent matches in ${category}, highest salience in the system.`;

        best = {
          id,
          name: country.name,
          alpha_2: country.alpha_2,
          tier: country.overall_risk_tier,
          topCategory: top.category,
          salience,
          recipeCount: top.recipe_count,
          nPredictors: nPred,
          narrative,
        };
      }
    }
    return best;
  }, [risks, topSignals]);

  // ── Outliers (Phase 1 fallback for Movers) ──────────────────────
  const outliers = useMemo(() => {
    if (!risks) return { rising: [], falling: [] };
    const allCountries: Array<{
      id: string;
      name: string;
      alpha_2: string;
      salience: number;
      tier: RiskTier;
    }> = [];
    for (const [id, country] of Object.entries(risks.countries)) {
      const cats = country.tiers?.S?.top_categories ?? [];
      const top = cats[0];
      const salience = top ? (top.salience_score ?? top.z_score ?? 0) : 0;
      allCountries.push({
        id,
        name: country.name,
        alpha_2: country.alpha_2,
        salience,
        tier: country.overall_risk_tier,
      });
    }
    if (allCountries.length === 0) return { rising: [], falling: [] };

    const sorted = [...allCountries].sort((a, b) => b.salience - a.salience);
    const median = sorted[Math.floor(sorted.length / 2)]?.salience ?? 0;

    const withDeviation = allCountries.map((c) => ({
      ...c,
      deviation: c.salience - median,
    }));
    const rising = withDeviation
      .filter((c) => c.deviation > 0)
      .sort((a, b) => b.deviation - a.deviation)
      .slice(0, 4);
    const falling = withDeviation
      .filter((c) => c.deviation < 0)
      .sort((a, b) => a.deviation - b.deviation)
      .slice(0, 4);
    return { rising, falling };
  }, [risks]);

  // ── Region heatstrip ────────────────────────────────────────────
  const regionData = useMemo(() => {
    if (!risks) return [];
    const regionCounts: Record<string, { total: number; high: number }> = {};
    for (const [id, country] of Object.entries(risks.countries)) {
      const region = REGION_MAP[id] ?? "Other";
      if (!regionCounts[region]) regionCounts[region] = { total: 0, high: 0 };
      regionCounts[region].total++;
      if (country.overall_risk_tier === "HIGH") regionCounts[region].high++;
    }
    return Object.entries(regionCounts)
      .map(([region, counts]) => ({
        region,
        label: REGION_LABELS[region] ?? region,
        ...counts,
      }))
      .sort((a, b) => b.high - a.high);
  }, [risks]);

  // ── Domain heatmap (L1 taxonomy aggregation) ────────────────────
  const domainHeatmap = useMemo(() => {
    if (!risks || !taxonomy?.layer1) return [];

    // Build L3 -> L1 mapping from taxonomy
    const l3ToL1: Record<string, string> = {};
    for (const l1 of taxonomy.layer1) {
      for (const l2 of l1.layer2) {
        for (const l3 of l2.layer3) {
          l3ToL1[l3] = l1.id;
        }
      }
    }

    // Count countries where each domain appears in top-3 categories
    const domainCountries: Record<string, Set<string>> = {};
    for (const l1 of taxonomy.layer1) {
      domainCountries[l1.id] = new Set();
    }

    for (const [id, country] of Object.entries(risks.countries)) {
      const cats = country.tiers?.S?.top_categories ?? [];
      for (const cat of cats.slice(0, 3)) {
        const l1Id = l3ToL1[cat.category];
        if (l1Id && domainCountries[l1Id]) {
          domainCountries[l1Id].add(id);
        }
      }
    }

    return taxonomy.layer1.map((l1) => ({
      id: l1.id,
      label: l1.display_label,
      color: l1.color_hint,
      count: domainCountries[l1.id]?.size ?? 0,
    }));
  }, [risks, taxonomy]);

  const maxDomainCount = Math.max(1, ...domainHeatmap.map((d) => d.count));

  // ── Top convergence signals ─────────────────────────────────────
  const topConvergences = useMemo(() => {
    return topSignals
      .filter((s) => (s.n_predictors ?? 0) >= 2)
      .sort((a, b) => (b.composite_sort_key ?? 0) - (a.composite_sort_key ?? 0))
      .slice(0, 5);
  }, [topSignals]);

  // ── Headline metrics ───────────────────────────────────────────
  const headlineMetrics = useMemo(() => {
    if (!risks) {
      return {
        sTierSignals: 0,
        risingSalience: 0,
        peakSalience: 0,
        activeConvergences: 0,
      };
    }

    let sTierSignals = 0;
    let risingSalience = 0;
    let peakSalience = 0;

    for (const country of Object.values(risks.countries)) {
      if (country.overall_risk_tier !== "HIGH") continue;
      const cats = country.tiers?.S?.top_categories ?? [];
      for (const cat of cats) {
        if (cat.recipe_count > 0) sTierSignals++;
        const sal = cat.salience_score ?? cat.z_score ?? 0;
        if (sal > peakSalience) peakSalience = sal;
      }
      const topSal = cats[0]?.salience_score ?? cats[0]?.z_score ?? 0;
      if (topSal > 1.5) risingSalience++;
    }

    const activeConvergences = topSignals.filter(
      (s) => (s.n_predictors ?? 0) >= 2
    ).length;

    return { sTierSignals, risingSalience, peakSalience, activeConvergences };
  }, [risks, topSignals]);

  // ── Sector counts for collapsed SectorRose ──────────────────────
  const sectorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const idx of indexes) {
      counts[idx.sector] = (counts[idx.sector] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [indexes]);

  // ── Freshness computation ──────────────────────────────────────
  const freshness = useMemo(() => {
    if (!stats.generatedAt) return { label: "Unknown", color: "#7a90a8", daysAgo: -1 };
    const gen = new Date(stats.generatedAt);
    const now = new Date();
    const diffMs = now.getTime() - gen.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    let color = "#34d399"; // green
    if (days > 30)
      color = "#f87171"; // red
    else if (days > 7) color = "var(--qgi-amber)"; // amber
    return {
      label: days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`,
      color,
      daysAgo: days,
    };
  }, [stats.generatedAt]);

  // ── Max salience for watchlist bar scaling ──────────────────────
  const maxSalience = Math.max(1, ...topCountries.map((c) => c.topSalience));

  // ── Navigator for pattern pairs ────────────────────────────────
  // T2 #295 HIGH fix: previously fell back to country NAMES when numeric IDs
  // were missing, producing malformed /patterns URLs (400 from API). Pattern
  // route only accepts numeric country ids — skip rows that don't have them.
  function navigateToPair(p: PatternRow) {
    if (!p.country_a_id || !p.country_b_id) {
      console.warn(
        `[BaseClient] Skipping pattern navigation — missing numeric IDs on row ${p.country_a}/${p.country_b}.`
      );
      return;
    }
    const qs = new URLSearchParams({
      // country_a_id / country_b_id are typed `string | number` post-T2
      // widening — URLSearchParams only accepts strings.
      country_a: String(p.country_a_id),
      country_b: String(p.country_b_id),
      length: String(p.pattern_length),
      start_a: String(p.start_year_a),
      start_b: String(p.start_year_b),
    });
    router.push(`/patterns?${qs}`);
  }

  // ── Cycle date ─────────────────────────────────────────────────
  const cycleDate = stats.generatedAt
    ? new Date(stats.generatedAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "---";

  const generatedShort = stats.generatedAt ? stats.generatedAt.slice(0, 10) : "---";

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ================================================================
          SECTION 1: MASTHEAD STRIP (40px) — PR-vi
          ================================================================ */}
      <div
        className="px-4 py-2 border-b shrink-0 flex items-center justify-between gap-4"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-surface)",
          minHeight: 40,
          maxHeight: 40,
        }}
      >
        <div className="flex items-center gap-2 text-[10px] font-data">
          <span style={{ color: "var(--qgi-text-muted)" }}>Cycle: {cycleDate}</span>
          <span style={{ color: "var(--qgi-text-dim)" }}>&#183;</span>
          <span style={{ color: "var(--qgi-text-muted)" }}>Scoring {stats.version}</span>
          <span style={{ color: "var(--qgi-text-dim)" }}>&#183;</span>
          {/* #431: disambiguate the three country numbers a curious user
              hits across the site. Tooltip explains the difference so the
              numeric drift QA found can't be re-introduced as confusion. */}
          <span
            style={{ color: "var(--qgi-text-muted)" }}
            title={`${stats.total} scored this cycle (countries that cleared the V1.9.1 scoring floor) · ${TOTAL_COUNTRIES} in pipeline scope (qgi_data.countries) · ${UN_STATES} UN-recognized states`}
          >
            {stats.total} scored / {TOTAL_COUNTRIES} in scope
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-data shrink-0">
          <span style={{ color: "var(--qgi-text-dim)" }}>
            Data as of {generatedShort}
          </span>
          <span style={{ color: "var(--qgi-text-dim)" }}>({freshness.label})</span>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: freshness.color }}
            title={`Freshness: ${freshness.label}`}
            aria-label={`Data freshness: ${freshness.label}`}
            role="img"
          />
        </div>
      </div>

      {/* ================================================================
          SECTION 2: PAGE HEADER + LEDE + "WHAT THIS DOESN'T MEAN" — PR-vi
          ================================================================ */}
      <div
        className="px-4 lg:px-6 py-5 border-b shrink-0"
        style={{ borderColor: "var(--qgi-border)" }}
      >
        <h1
          className="text-3xl font-semibold tracking-tight mb-2"
          style={{ color: "var(--qgi-text)" }}
        >
          Dashboard
        </h1>
        <p
          className="text-sm leading-relaxed max-w-[68ch] mb-3"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          QGI tracks political risk across {stats.total} countries, using historical
          precedent to identify where signals most closely resemble known instability
          patterns.
        </p>
        <details
          role="note"
          aria-label="Methodology note"
          className="text-xs max-w-[68ch]"
        >
          <summary
            className="cursor-pointer select-none inline-flex items-center gap-1.5"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            <span
              className="font-semibold tracking-wide uppercase text-[10px]"
              style={{ color: "var(--qgi-amber)" }}
            >
              What this doesn&apos;t mean
            </span>
            <span style={{ color: "var(--qgi-text-dim)" }}>(expand)</span>
          </summary>
          <p
            className="mt-2 pl-3 border-l-2 leading-relaxed"
            style={{
              color: "var(--qgi-text-muted)",
              borderColor: "rgba(245, 158, 11, 0.4)",
            }}
          >
            A HIGH classification means the country&apos;s indicator profile most closely
            resembles known historical instability precedents — it is not a prediction
            that an event will occur. The pages reached from here report model output
            reviewed for editorial release, not forecasts.
          </p>
        </details>
      </div>

      {/* ================================================================
          SECTION 3: FOUR-FAMILY SUMMARY BAND — PR-vi (the core new element)
          One dominant number per family. Each card is a clickable CTA into
          the deeper family page. Numbers come from the same JSONs the family
          pages use — zero new data sources, zero Athena hits.
          ================================================================ */}
      <FourFamilyBand
        countriesHigh={stats.high}
        signalsHighCount={signalsHighCount}
        signalsModerateCount={signalsModerateCount}
        signalsTotalCount={signalsTotalCount}
        topPair={topPairs[0] ?? null}
        totalUniquePairs={totalUniquePairs}
        mlValidatedCount={mlValidatedCount}
        totalLocked={totalLocked}
      />

      {/* ================================================================
          ZONE 2: SITUATION SUMMARY
          ================================================================ */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-px shrink-0"
        style={{ backgroundColor: "var(--qgi-border)" }}
      >
        {/* ── Featured Alert Card (left) ──────────────────────────── */}
        <div className="flex flex-col" style={{ backgroundColor: "var(--qgi-bg)" }}>
          <div
            className="px-4 py-2 border-b"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <span
              className="text-[9px] tracking-[0.25em] uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Featured Signal
            </span>
          </div>
          {featuredAlert ? (
            <Link
              href={`/countries/${featuredAlert.id}`}
              className="flex-1 px-4 py-3 transition-colors hover:bg-[var(--qgi-surface-2)] relative"
              style={{
                borderLeft: `3px solid ${TIER_STYLES[featuredAlert.tier].border}`,
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <CountryFlag alpha2={featuredAlert.alpha_2} size={24} />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-semibold"
                    style={{ color: "var(--qgi-text)" }}
                  >
                    {featuredAlert.name}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
                    {featuredAlert.alpha_2}
                  </div>
                </div>
                <span
                  className="text-[9px] tracking-wider font-semibold px-2 py-0.5 rounded shrink-0"
                  aria-label={`Risk tier: ${featuredAlert.tier}`}
                  style={{
                    backgroundColor: TIER_STYLES[featuredAlert.tier].bg,
                    color: TIER_STYLES[featuredAlert.tier].text,
                    border: `1px solid ${TIER_STYLES[featuredAlert.tier].border}30`,
                  }}
                >
                  {featuredAlert.tier}
                </span>
              </div>
              <p
                className="text-xs leading-relaxed mb-3"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                {featuredAlert.narrative}
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <span
                  className="text-[9px] px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: "var(--qgi-surface-2)",
                    color: "var(--qgi-text-muted)",
                  }}
                >
                  {formatCategory(featuredAlert.topCategory)}
                </span>
                <span
                  className="font-data text-[10px]"
                  style={{ color: "var(--qgi-amber)" }}
                >
                  Salience {featuredAlert.salience.toFixed(2)}
                </span>
                <span
                  className="font-data text-[10px]"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {featuredAlert.recipeCount.toLocaleString()} precedents
                </span>
                {featuredAlert.nPredictors >= 2 && (
                  <span className="font-data text-[10px]" style={{ color: "#fb923c" }}>
                    {featuredAlert.nPredictors} predictors
                  </span>
                )}
              </div>
              {/* PR-vi: lineage caption per Majles spec (Marcus dissent
                  resolution + voice rules). Methodology integrity — prevents
                  the algorithmic selection from being mis-read as an
                  editorial endorsement of the country. */}
              <p
                className="text-[10px] italic mt-2"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Algorithmically selected — highest-signal curated country in the current
                bake.
              </p>
            </Link>
          ) : (
            <div
              className="flex-1 flex items-center justify-center py-8 text-[10px]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              No alert data available
            </div>
          )}
        </div>

        {/* ── Risk Pulse Panel (right) ────────────────────────────── */}
        <div className="flex flex-col" style={{ backgroundColor: "var(--qgi-bg)" }}>
          <div
            className="px-4 py-2 border-b"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <span
              className="text-[9px] tracking-[0.25em] uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Risk Pulse
            </span>
          </div>
          <div className="px-4 py-3 flex-1 flex flex-col gap-3">
            {/* Tier distribution bar */}
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <span
                  className="text-[9px] tracking-wider uppercase"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  Tier Distribution
                </span>
                <InfoTooltip text="Proportion of countries in each risk tier: HIGH (red), MODERATE (amber), INDICATIVE (blue)." />
              </div>
              <div
                className="flex h-6 rounded overflow-hidden"
                style={{ backgroundColor: "var(--qgi-surface-2)" }}
              >
                {stats.total > 0 && (
                  <>
                    <TierSegment
                      count={stats.high}
                      total={stats.total}
                      color="#f87171"
                      label="HIGH"
                    />
                    <TierSegment
                      count={stats.moderate}
                      total={stats.total}
                      color="var(--qgi-amber)"
                      label="MOD"
                    />
                    <TierSegment
                      count={stats.indicative}
                      total={stats.total}
                      color="#38bdf8"
                      label="IND"
                    />
                  </>
                )}
              </div>
              <div
                className="text-right text-[9px] font-data mt-0.5"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {stats.total} total
              </div>
            </div>

            {/* Region heatstrip */}
            <div>
              <span
                className="text-[9px] tracking-wider uppercase block mb-1.5"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Regional Breakdown
              </span>
              <div className="flex gap-1 flex-wrap">
                {regionData.map((r) => {
                  const maxHigh = Math.max(1, ...regionData.map((rd) => rd.high));
                  const opacity = Math.max(0.15, r.high / maxHigh);
                  return (
                    <div
                      key={r.region}
                      className="flex flex-col items-center px-2 py-1 rounded text-center"
                      style={{
                        backgroundColor: `rgba(248, 113, 113, ${opacity * 0.3})`,
                        border: "1px solid rgba(248, 113, 113, 0.1)",
                      }}
                      title={`${r.label}: ${r.high} HIGH / ${r.total} total`}
                    >
                      <span
                        className="text-[9px] font-semibold tracking-wider"
                        style={{ color: "var(--qgi-text-muted)" }}
                      >
                        {r.region}
                      </span>
                      <span
                        className="font-data text-[10px] font-bold"
                        style={{
                          color: r.high > 0 ? "#f87171" : "var(--qgi-text-dim)",
                        }}
                      >
                        {r.high}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PR-vi: 4 MetricTiles removed — replaced by the FourFamilyBand
                above. The `MetricTile` helper component is retained at the
                bottom of this file in case the Risk Pulse panel needs it
                again, but no callers remain on the Dashboard. */}
          </div>
        </div>
      </div>

      {/* World map removed per owner request (2026-04-18) */}

      {/* ================================================================
          SECTION 5: INTELLIGENCE GRID — Watchlist + Salience Spread — PR-vi
          ================================================================ */}
      <section
        aria-labelledby="watchlist-heading"
        className="grid grid-cols-1 lg:grid-cols-5 gap-px shrink-0"
        style={{ backgroundColor: "var(--qgi-border)" }}
      >
        <h2 id="watchlist-heading" className="sr-only">
          Watchlist and salience spread
        </h2>
        {/* ── Watchlist (left, 3/5 width) ─────────────────────────── */}
        <div
          className="lg:col-span-3 flex flex-col"
          style={{ backgroundColor: "var(--qgi-bg)" }}
        >
          <div
            className="px-4 py-2 border-b flex items-baseline justify-between"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <div>
              <span
                className="text-[9px] tracking-[0.25em] uppercase"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Watchlist
              </span>
              <span className="text-[10px] ml-2" style={{ color: "var(--qgi-text-dim)" }}>
                Top 10 by peak salience
              </span>
            </div>
            <Link
              href="/countries?tier=HIGH"
              className="text-[9px] tracking-wider transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              All {stats.high}
              {" high-risk countries →"}
            </Link>
          </div>
          {topCountries.length === 0 ? (
            <div
              className="flex items-center justify-center py-10 text-[10px]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              No country risk data
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--qgi-border)" }}>
              {topCountries.map((c, i) => {
                const style = TIER_STYLES[c.tier];
                const barWidth = (c.topSalience / maxSalience) * 100;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/countries/${c.id}`}
                      className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-[var(--qgi-surface-2)] relative"
                    >
                      {/* Salience bar background */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `linear-gradient(to right, ${style.border}12 ${barWidth}%, transparent ${barWidth}%)`,
                        }}
                      />
                      <span
                        className="font-data text-[10px] w-5 text-right shrink-0 relative"
                        style={{ color: "var(--qgi-text-dim)" }}
                      >
                        {i + 1}
                      </span>
                      <CountryFlag alpha2={c.alpha_2} size={14} />
                      <div className="flex-1 min-w-0 relative">
                        <div className="flex items-baseline gap-2">
                          <span
                            className="text-xs font-medium truncate"
                            style={{ color: "var(--qgi-text)" }}
                          >
                            {c.name}
                          </span>
                          {c.curated && (
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: "var(--qgi-accent)" }}
                              title="Curated"
                            />
                          )}
                        </div>
                        <div
                          className="text-[10px] truncate"
                          style={{ color: "var(--qgi-text-dim)" }}
                        >
                          {c.topCategories.map((cat) => formatCategory(cat)).join(", ")}
                        </div>
                      </div>
                      <span
                        className="font-data text-[10px] font-semibold shrink-0 relative"
                        style={{ color: style.text }}
                      >
                        {c.topSalience.toFixed(2)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Outliers (right, 2/5 width) — Phase 1 fallback for Movers */}
        <div
          className="lg:col-span-2 flex flex-col"
          style={{ backgroundColor: "var(--qgi-bg)" }}
        >
          <div
            className="px-4 py-2 border-b flex items-baseline justify-between"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <div>
              <span
                className="text-[9px] tracking-[0.25em] uppercase"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Salience Spread
              </span>
              <InfoTooltip text="Countries whose salience deviates most from the median in the current bake. This is a cross-sectional spread, not a time-series delta — it does not indicate change since a previous bake." />
            </div>
          </div>
          <div className="flex-1 px-4 py-2">
            {/* Rising */}
            <div className="mb-3">
              <span
                className="text-[9px] tracking-wider uppercase block mb-1"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Above Median
              </span>
              {outliers.rising.length === 0 ? (
                <span className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
                  No data
                </span>
              ) : (
                <ul className="space-y-1">
                  {outliers.rising.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/countries/${c.id}`}
                        className="flex items-center gap-2 py-1 transition-colors hover:bg-[var(--qgi-surface-2)] rounded px-2 -mx-2"
                      >
                        <CountryFlag alpha2={c.alpha_2} size={12} />
                        <span
                          className="text-[11px] flex-1 truncate"
                          style={{ color: "var(--qgi-text)" }}
                        >
                          {c.name}
                        </span>
                        <span
                          className="font-data text-[10px] font-semibold"
                          style={{ color: "#f87171" }}
                        >
                          +{c.deviation.toFixed(2)} &#9650;
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Falling */}
            <div>
              <span
                className="text-[9px] tracking-wider uppercase block mb-1"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Below Median
              </span>
              {outliers.falling.length === 0 ? (
                <span className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
                  No data
                </span>
              ) : (
                <ul className="space-y-1">
                  {outliers.falling.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/countries/${c.id}`}
                        className="flex items-center gap-2 py-1 transition-colors hover:bg-[var(--qgi-surface-2)] rounded px-2 -mx-2"
                      >
                        <CountryFlag alpha2={c.alpha_2} size={12} />
                        <span
                          className="text-[11px] flex-1 truncate"
                          style={{ color: "var(--qgi-text)" }}
                        >
                          {c.name}
                        </span>
                        <span
                          className="font-data text-[10px] font-semibold"
                          style={{ color: "#34d399" }}
                        >
                          {c.deviation.toFixed(2)} &#9660;
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          SECTION 6: SIGNAL + PATTERN SNAPSHOT (2-column) — PR-vi
          Domain Heatmap zone removed per Majles verdict — moved to the
          /signals page where the 8-domain activation strip lives with
          real data (signals/page.tsx PR #2).
          ================================================================ */}
      <section
        aria-labelledby="signal-snapshot-heading"
        className="grid grid-cols-1 md:grid-cols-2 gap-px shrink-0"
        style={{ backgroundColor: "var(--qgi-border)" }}
      >
        <h2 id="signal-snapshot-heading" className="sr-only">
          Signal and pattern snapshot
        </h2>
        {/* PR-vi: Domain Heatmap column removed. The conditional block is kept
            empty and unreachable below — the legacy heatmap loop is dead. */}
        {false && (
          <div className="flex flex-col" style={{ backgroundColor: "var(--qgi-bg)" }}>
            <div
              className="px-4 py-2 border-b"
              style={{ borderColor: "var(--qgi-border)" }}
            >
              <span
                className="text-[9px] tracking-[0.25em] uppercase"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Domain Heatmap
              </span>
              <InfoTooltip text="Count of countries where each L1 taxonomy domain appears in the top 3 S-tier categories." />
            </div>
            <div className="px-4 py-2 flex-1">
              {domainHeatmap.length === 0 ? (
                <div
                  className="text-[10px] py-4 text-center"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  No domain data
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {domainHeatmap.map((d) => {
                    const barWidth = (d.count / maxDomainCount) * 100;
                    return (
                      <li key={d.id} className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: d.color }}
                        />
                        <span
                          className="text-[10px] w-28 shrink-0 truncate"
                          style={{ color: "var(--qgi-text-muted)" }}
                        >
                          {d.id} {d.label}
                        </span>
                        <div
                          className="flex-1 h-3 rounded overflow-hidden"
                          style={{ backgroundColor: "var(--qgi-surface-2)" }}
                        >
                          <div
                            className="h-full rounded transition-all"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: d.color,
                              opacity: 0.6,
                            }}
                          />
                        </div>
                        <span
                          className="font-data text-[10px] w-6 text-right shrink-0"
                          style={{ color: "var(--qgi-text-dim)" }}
                        >
                          {d.count}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
        {/* /PR-vi: end dead Domain Heatmap block */}

        {/* ── Top Convergences (left, was middle) ─────────────────── */}
        <div className="flex flex-col" style={{ backgroundColor: "var(--qgi-bg)" }}>
          <div
            className="px-4 py-2 border-b flex items-baseline justify-between"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <div>
              <span
                className="text-[9px] tracking-[0.25em] uppercase"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                Top Convergences
              </span>
              <InfoTooltip text="Signals where 2+ independent predictor countries corroborate the same risk trajectory." />
            </div>
            <Link
              href="/signals"
              className="text-[9px] tracking-wider transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              All signals &#8594;
            </Link>
          </div>
          {topConvergences.length === 0 ? (
            <div
              className="flex-1 flex items-center justify-center py-8 text-[10px]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              No convergence signals
            </div>
          ) : (
            <ul className="divide-y flex-1" style={{ borderColor: "var(--qgi-border)" }}>
              {topConvergences.map((s, i) => {
                const convColor = s.convergence_tier
                  ? CONVERGENCE_COLORS[s.convergence_tier]
                  : "#7a90a8";
                const convLabel = s.convergence_tier
                  ? CONVERGENCE_LABELS[s.convergence_tier]
                  : "Unknown";
                // PR-vii (2026-05-15) — convergence rows had hover-highlight
                // but no link wrapper, so users clicked and nothing happened.
                // Route to /precedents/{event_category} (recipe detail page);
                // event_category is the L3 taxonomy slug, same shape that
                // /precedents/[slug] resolves.
                const rowHref = `/precedents/${s.event_category}` as Route;
                return (
                  <li key={`${s.recipe_id ?? i}`}>
                    <Link
                      href={rowHref}
                      className="block px-4 py-2 hover:bg-[var(--qgi-surface-2)] transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-[11px] font-medium truncate"
                          style={{ color: "var(--qgi-text)" }}
                        >
                          {s.country_a_name}
                        </span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            backgroundColor: `${convColor}20`,
                            color: convColor,
                            border: `1px solid ${convColor}30`,
                          }}
                          title={convLabel}
                        >
                          {s.n_predictors ?? 0}p
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] truncate"
                          style={{ color: "var(--qgi-text-dim)" }}
                        >
                          {formatCategory(s.event_category)}
                        </span>
                        {s.median_lead_time != null && (
                          <span
                            className="font-data text-[9px] shrink-0"
                            style={{ color: "var(--qgi-text-dim)" }}
                          >
                            {s.median_lead_time}yr lead
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── Top Pattern Pairs (right) ───────────────────────────── */}
        <div className="flex flex-col" style={{ backgroundColor: "var(--qgi-bg)" }}>
          <div
            className="px-4 py-2 border-b flex items-baseline justify-between"
            style={{ borderColor: "var(--qgi-border)" }}
          >
            <span
              className="text-[9px] tracking-[0.25em] uppercase"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Top Pattern Pairs
            </span>
            <Link
              href="/patterns/ranking"
              className="text-[9px] tracking-wider transition-colors hover:text-[var(--qgi-accent)]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Full ranking &#8594;
            </Link>
          </div>
          {topPairs.length === 0 ? (
            <div
              className="flex-1 flex items-center justify-center py-8 text-[10px]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              Pattern data unavailable
            </div>
          ) : (
            <ul className="divide-y flex-1" style={{ borderColor: "var(--qgi-border)" }}>
              {topPairs.slice(0, 5).map((p, i) => (
                <li key={`${p.country_a}-${p.country_b}-${i}`}>
                  <button
                    onClick={() => navigateToPair(p)}
                    aria-disabled={
                      !p.country_a_id || !p.country_b_id ? "true" : undefined
                    }
                    className="w-full text-left flex items-center gap-3 px-4 py-2 transition-colors hover:bg-[var(--qgi-surface-2)]"
                  >
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[11px] font-medium truncate"
                        style={{ color: "var(--qgi-text)" }}
                      >
                        <span style={{ color: "var(--qgi-country-a)" }}>
                          {p.country_a}
                        </span>
                        <span className="mx-1" style={{ color: "var(--qgi-text-dim)" }}>
                          &#8594;
                        </span>
                        <span style={{ color: "var(--qgi-country-b)" }}>
                          {p.country_b}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-[10px]"
                          style={{ color: "var(--qgi-text-dim)" }}
                        >
                          {p.pattern_length}-yr
                        </span>
                        {/* Inline correlation bar */}
                        <div
                          className="h-1.5 w-12 rounded overflow-hidden"
                          style={{
                            backgroundColor: "var(--qgi-surface-2)",
                          }}
                        >
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${p.avg_correlation * 100}%`,
                              backgroundColor:
                                p.avg_correlation >= 0.8
                                  ? "#34d399"
                                  : p.avg_correlation >= 0.6
                                    ? "var(--qgi-amber)"
                                    : "#7a90a8",
                            }}
                          />
                        </div>
                        <span
                          className="font-data text-[9px]"
                          style={{ color: "var(--qgi-text-dim)" }}
                        >
                          {(p.avg_correlation * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <span
                      className="font-data text-[10px] font-semibold shrink-0"
                      style={{ color: "var(--qgi-amber)" }}
                      title="Pattern Power Score — strength + persistence + breadth"
                    >
                      Score {p.pattern_power_score.toFixed(0)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ================================================================
          SECTION 7: FOOTER DISCLOSURE — PR-vi
          Single-line footer with bake date + scoring version + methodology
          link. Replaces the old Data Foundation accordion (moved to the
          dedicated /methodology page per Majles verdict).
          ================================================================ */}
      <footer
        className="border-t shrink-0 px-4 lg:px-6 py-3 text-[10px] tracking-wider"
        style={{
          borderColor: "var(--qgi-border)",
          backgroundColor: "var(--qgi-bg)",
          color: "var(--qgi-text-dim)",
        }}
      >
        {stats.version} scoring · Data as of {generatedShort} · Tier vocabulary: HIGH /
        MODERATE / INDICATIVE ·{" "}
        <Link
          href="/methodology"
          className="underline underline-offset-2 transition-colors hover:text-[var(--qgi-accent)]"
        >
          Methodology &amp; known limitations &#8594;
        </Link>
      </footer>

      {/* ================================================================
          LEGACY ZONE 5: DATA FOUNDATION (PR-vi: dead block, retained for
          potential future re-enable; rendering gated to never run)
          ================================================================ */}
      {false && (
        <div
          className="border-t shrink-0"
          style={{
            borderColor: "var(--qgi-border)",
            backgroundColor: "var(--qgi-bg)",
          }}
        >
          <button
            onClick={() => setDataFoundationOpen(!dataFoundationOpen)}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[var(--qgi-surface-2)] transition-colors"
          >
            <span
              className="text-[10px] transition-transform"
              style={{
                color: "var(--qgi-text-dim)",
                transform: dataFoundationOpen ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              &#9654;
            </span>
            <span className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
              Data foundation:
            </span>
            <span
              className="font-data text-[10px]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              {indexes.length} indicators across {sectorCounts.length} sectors
            </span>
            <span className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
              &#183;
            </span>
            <span
              className="font-data text-[10px]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Scoring {stats.version}
            </span>
            <span className="text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
              &#183;
            </span>
            <span
              className="font-data text-[10px]"
              style={{ color: "var(--qgi-text-muted)" }}
            >
              Last pipeline: {generatedShort}
            </span>
            <span className="flex-1" />
            <Link
              href="/methodology#data-sources"
              className="text-[9px] tracking-wider hover:text-[var(--qgi-accent)] transition-colors"
              style={{ color: "var(--qgi-text-dim)" }}
              onClick={(e) => e.stopPropagation()}
            >
              Methodology &#8594;
            </Link>
          </button>

          {dataFoundationOpen && (
            <div
              className="grid grid-cols-1 lg:grid-cols-3 gap-px border-t"
              style={{
                borderColor: "var(--qgi-border)",
                backgroundColor: "var(--qgi-border)",
              }}
            >
              {/* Sector rose */}
              <div
                className="flex flex-col min-h-0"
                style={{ backgroundColor: "var(--qgi-bg)" }}
              >
                <div
                  className="text-[9px] tracking-[0.25em] uppercase px-4 py-2 border-b"
                  style={{
                    color: "var(--qgi-text-dim)",
                    borderColor: "var(--qgi-border)",
                  }}
                >
                  Indicators by Sector
                </div>
                <div className="h-[200px]">
                  <SectorRose
                    data={sectorCounts}
                    activeSector={null}
                    onSectorClick={() => {}}
                  />
                </div>
              </div>

              {/* Stats grid */}
              <div
                className="lg:col-span-2 flex flex-col"
                style={{ backgroundColor: "var(--qgi-bg)" }}
              >
                <div
                  className="text-[9px] tracking-[0.25em] uppercase px-4 py-2 border-b"
                  style={{
                    color: "var(--qgi-text-dim)",
                    borderColor: "var(--qgi-border)",
                  }}
                >
                  Coverage Summary
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4">
                  <FooterStat
                    label="Total indicators"
                    value={indexes.length.toString()}
                  />
                  <FooterStat label="Sectors" value={sectorCounts.length.toString()} />
                  <FooterStat
                    label="Pattern pairs"
                    value={totalUniquePairs.toLocaleString()}
                  />
                  <FooterStat
                    label="Curated countries"
                    value={`${stats.curated} / ${stats.total}`}
                  />
                </div>
                <div className="px-4 pb-3">
                  <Link
                    href="/methodology#data-sources"
                    className="text-[10px] tracking-wider hover:text-[var(--qgi-accent)] transition-colors"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    Full indicator catalogue &#8594;
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* /PR-vi: end dead Data Foundation block */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TierSegment({
  count,
  total,
  color,
  label,
}: {
  count: number;
  total: number;
  color: string;
  label: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  if (count === 0) return null;
  return (
    <div
      className="flex items-center justify-center relative overflow-hidden"
      style={{
        width: `${pct}%`,
        backgroundColor: `${color}30`,
        borderRight: "1px solid var(--qgi-bg)",
      }}
      title={`${label}: ${count} (${pct.toFixed(0)}%)`}
    >
      {pct >= 12 && (
        <span className="font-data text-[9px] font-bold" style={{ color }}>
          {count}
        </span>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string | number;
  tooltip: string;
}) {
  // T2 #295 cleanup: `isNumber` prop was defined but applied `""` in both
  // branches (dead code). Removed.
  return (
    <div className="px-3 py-2 rounded" style={{ backgroundColor: "var(--qgi-surface)" }}>
      <div className="flex items-center gap-1">
        <span
          className="text-[9px] tracking-wider uppercase"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {label}
        </span>
        <InfoTooltip text={tooltip} />
      </div>
      <div
        className="font-data text-lg font-semibold mt-0.5"
        style={{ color: "var(--qgi-amber)" }}
      >
        {value}
      </div>
    </div>
  );
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[9px] tracking-wider uppercase mb-0.5"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {label}
      </div>
      <div
        className="font-data text-sm font-semibold"
        style={{ color: "var(--qgi-accent)" }}
      >
        {value}
      </div>
    </div>
  );
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ===========================================================================
// PR-vi (2026-05-15) — Four-family summary band
// ---------------------------------------------------------------------------
// Section 3 of the Dashboard. One dominant number per V3 family, each card
// is a clickable CTA into the deeper family page.
//
// E1 fallback rule (per Majles engineering pre-flight): when the signals
// HIGH count is < 3, the Signals card shows (n_high + n_moderate) in amber
// labeled "risk categories at elevated signal levels" instead of red "{n}
// firing HIGH". This prevents the masthead from rendering a misleading "1"
// in HIGH color when only one category clears the strict z >= 2.5 threshold.
// ===========================================================================

function FourFamilyBand({
  countriesHigh,
  signalsHighCount,
  signalsModerateCount,
  signalsTotalCount,
  topPair,
  totalUniquePairs,
  mlValidatedCount,
  totalLocked,
}: {
  countriesHigh: number;
  signalsHighCount: number;
  signalsModerateCount: number;
  signalsTotalCount: number;
  topPair: PatternRow | null;
  totalUniquePairs: number;
  mlValidatedCount: number;
  totalLocked: number;
}) {
  // E1 fallback rule.
  const signalsUseHigh = signalsHighCount >= 3;
  const signalsNumber = signalsUseHigh
    ? signalsHighCount
    : signalsHighCount + signalsModerateCount;
  const signalsLabel = signalsUseHigh
    ? "risk categories firing HIGH"
    : "risk categories at elevated signal levels";
  const signalsColor = signalsUseHigh ? "#f87171" : "var(--qgi-amber)";

  return (
    <section
      aria-label="QGI family summary"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px shrink-0 border-b"
      style={{
        backgroundColor: "var(--qgi-border)",
        borderColor: "var(--qgi-border)",
      }}
    >
      {/* Countries card */}
      <Link
        href="/countries"
        className="flex flex-col px-4 lg:px-6 py-5 transition-colors hover:bg-[var(--qgi-surface-2)]"
        style={{ backgroundColor: "var(--qgi-bg)" }}
      >
        <span
          className="text-[9px] tracking-[0.25em] uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Countries
        </span>
        <span
          className="font-data text-4xl font-bold leading-none mb-1.5 tabular-nums"
          style={{ color: "#f87171" }}
        >
          {countriesHigh}
        </span>
        <span className="text-xs" style={{ color: "var(--qgi-text-muted)" }}>
          countries at elevated risk
        </span>
        <span
          className="text-[10px] tracking-wider mt-3 transition-colors"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          See all HIGH countries &#8594;
        </span>
      </Link>

      {/* Signals card */}
      <Link
        href="/signals"
        className="flex flex-col px-4 lg:px-6 py-5 transition-colors hover:bg-[var(--qgi-surface-2)]"
        style={{ backgroundColor: "var(--qgi-bg)" }}
      >
        <span
          className="text-[9px] tracking-[0.25em] uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Signals
        </span>
        <span
          className="font-data text-4xl font-bold leading-none mb-1.5 tabular-nums"
          style={{ color: signalsColor }}
        >
          {signalsNumber}
        </span>
        <span className="text-xs" style={{ color: "var(--qgi-text-muted)" }}>
          {signalsLabel}
        </span>
        <span
          className="text-[10px] tracking-wider mt-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          See all {signalsTotalCount}
          {" risk categories →"}
        </span>
      </Link>

      {/* Patterns card */}
      <Link
        href="/patterns"
        className="flex flex-col px-4 lg:px-6 py-5 transition-colors hover:bg-[var(--qgi-surface-2)]"
        style={{ backgroundColor: "var(--qgi-bg)" }}
      >
        <span
          className="text-[9px] tracking-[0.25em] uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Patterns
        </span>
        <span
          className="font-data text-4xl font-bold leading-none mb-1.5 tabular-nums"
          style={{ color: "var(--qgi-accent)" }}
        >
          {topPair ? topPair.pattern_power_score.toFixed(0) : "—"}
        </span>
        <span className="text-xs leading-snug" style={{ color: "var(--qgi-text-muted)" }}>
          {topPair ? (
            <>
              {topPair.country_a} → {topPair.country_b} · {topPair.pattern_length}y ·{" "}
              {(topPair.avg_correlation * 100).toFixed(0)}% corr
            </>
          ) : (
            "top pattern pair"
          )}
        </span>
        <span
          className="text-[10px] tracking-wider mt-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          See all {totalUniquePairs}
          {" pairs →"}
        </span>
      </Link>

      {/* Precedents card */}
      <Link
        href="/precedents"
        className="flex flex-col px-4 lg:px-6 py-5 transition-colors hover:bg-[var(--qgi-surface-2)]"
        style={{ backgroundColor: "var(--qgi-bg)" }}
      >
        <span
          className="text-[9px] tracking-[0.25em] uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Precedents
        </span>
        <span
          className="font-data text-4xl font-bold leading-none mb-1.5 tabular-nums"
          style={{ color: "var(--qgi-accent)" }}
        >
          {mlValidatedCount}
          <span className="text-2xl font-normal" style={{ color: "var(--qgi-text-dim)" }}>
            {" "}
            / {totalLocked}
          </span>
        </span>
        <span className="text-xs" style={{ color: "var(--qgi-text-muted)" }}>
          ML-validated recipes / locked set
        </span>
        <span
          className="text-[10px] tracking-wider mt-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          See all recipes &#8594;
        </span>
      </Link>
    </section>
  );
}
