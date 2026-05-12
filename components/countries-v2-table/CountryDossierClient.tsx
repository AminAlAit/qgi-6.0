"use client";

/**
 * CountryDossierClient — Dense per-country analyst dossier
 * Design: Elif Şahin-Moreau + Rodrigo Vasconcelos-Kwok
 *
 * Sections:
 *   1. Hero: flag + name + tier + top-line scores
 *   2. Tier breakdown table: S/M/L/XL × top categories (real data)
 *   3. Per-L1 percentile micro-bars (real structure, MOCK percentile values)
 *   4. ML coverage matrix: 13 LOCKed recipes × AHI status (MOCK where missing)
 *   5. Recent events (MOCK)
 *   6. Indicator panel (MOCK)
 *
 * MOCK items are tagged with // MOCK inline.
 */

import Link from "next/link";
import { CountryFlag } from "@/components/design/CountryFlag";
import type { CountryRisk, RiskTier } from "@/lib/country-risks";
import type { MlRecipeStack } from "@/lib/recipes-ml";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  countryId: string;
  countryData: CountryRisk;
  mlStack: MlRecipeStack | null;
}

// ---------------------------------------------------------------------------
// Tier visual
// ---------------------------------------------------------------------------
const TIER_META: Record<
  RiskTier,
  { label: string; color: string; bg: string; border: string }
> = {
  HIGH: {
    label: "HIGH",
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.35)",
  },
  MODERATE: {
    label: "MODERATE",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.35)",
  },
  INDICATIVE: {
    label: "INDICATIVE",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.10)",
    border: "rgba(56,189,248,0.35)",
  },
};

// ---------------------------------------------------------------------------
// L1 metadata (must match CountriesClient.tsx L1_META)
// ---------------------------------------------------------------------------
const L1_META: Record<string, { label: string; full: string; color: string }> = {
  A: { label: "POL", full: "Political Power", color: "#7B5EE6" },
  B: { label: "CON", full: "Conflict & Violence", color: "#E64545" },
  C: { label: "GOV", full: "Governance & Rights", color: "#E68F29" },
  D: { label: "ECO", full: "Economic Stress", color: "#3FA9F5" },
  E: { label: "SOC", full: "Social Mobilization", color: "#3FBF8F" },
  F: { label: "DIP", full: "Diplomacy & Geopolitics", color: "#9F7AEA" },
  G: { label: "HUM", full: "Humanitarian Crisis", color: "#E94989" },
  H: { label: "STR", full: "Structural Trends", color: "#7A8FA0" },
};

const L1_IDS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// ---------------------------------------------------------------------------
// 13 LOCKed recipes (post-KI-2 amendment 2026-05-11)
// ---------------------------------------------------------------------------
const ALL_LOCKED_RECIPES = [
  { id: "civil_war_and_insurgency", label: "Civil war & insurgency" },
  { id: "multilateral_agreement", label: "Multilateral agreement" },
  { id: "elections_and_voting", label: "Elections & voting" },
  { id: "bilateral_treaty", label: "Bilateral treaty" },
  { id: "energy_policy", label: "Energy policy" },
  { id: "epidemic_and_pandemic", label: "Epidemic & pandemic" },
  { id: "foreign_intervention", label: "Foreign intervention" },
  { id: "government_formation", label: "Government formation" },
  { id: "human_rights_violation", label: "Human rights violation" },
  { id: "humanitarian_crisis", label: "Humanitarian crisis" },
  { id: "mass_protest", label: "Mass protest" },
  { id: "peacekeeping_and_peace_process", label: "Peacekeeping & peace process" },
  { id: "terrorist_attack", label: "Terrorist attack" },
];

// ---------------------------------------------------------------------------
// Mock helpers (deterministic)
// ---------------------------------------------------------------------------
function seededRng(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = Math.imul(16807, h) | 0;
    return (h >>> 0) / 0xffffffff;
  };
}

/** MOCK: percentile rank 0–1 for this country on a given L1 dimension */
function mockL1Percentile(countryId: string, l1: string): number {
  const rng = seededRng(`pct:${countryId}:${l1}`);
  return rng();
}

/** MOCK: whether this country has an AHI score for this recipe */
function mockRecipeCoverage(
  countryId: string,
  recipeId: string
): {
  covered: boolean;
  ahi: number | null;
  percentile: number | null;
} {
  const rng = seededRng(`coverage:${countryId}:${recipeId}`);
  const covered = rng() > 0.5; // MOCK: ~50% coverage
  if (!covered) return { covered: false, ahi: null, percentile: null };
  const ahi = Math.round(rng() * 100) / 100;
  const pct = Math.round(rng() * 100);
  return { covered: true, ahi, percentile: pct };
}

/** MOCK: recent events */
function mockRecentEvents(
  countryId: string,
  tier: RiskTier
): Array<{
  date: string;
  title: string;
  category: string;
  severity: number;
}> {
  const rng = seededRng(`events:${countryId}`);
  const n = tier === "HIGH" ? 8 : tier === "MODERATE" ? 5 : 3;
  const titles = [
    "Government reshuffle following parliamentary deadlock",
    "Protests erupt in capital over economic austerity measures",
    "Bilateral trade agreement signed with neighbouring state",
    "Security forces deployed amid border tensions",
    "IMF delegation completes Article IV consultation",
    "Opposition coalition announces boycott of upcoming election",
    "Central bank raises rates as inflation reaches 14%",
    "UN Human Rights Council issues country report",
    "Mass demonstration in three cities; police respond",
    "Cabinet approves emergency energy rationing decree",
  ];
  const cats = [
    "Political Power",
    "Economic Stress",
    "Diplomacy & Geopolitics",
    "Conflict & Violence",
    "Governance & Rights",
  ];
  return Array.from({ length: n }, () => {
    const daysAgo = Math.floor(rng() * 365);
    const d = new Date(Date.now() - daysAgo * 86400000);
    return {
      date: d.toISOString().slice(0, 10),
      title: titles[Math.floor(rng() * titles.length)],
      category: cats[Math.floor(rng() * cats.length)],
      severity: Math.ceil(rng() * 3),
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

/** MOCK: indicator panel entries */
function mockIndicators(countryId: string): Array<{
  code: string;
  label: string;
  value: number;
  unit: string;
  year: number;
  trend: "up" | "down" | "flat";
}> {
  const rng = seededRng(`ind:${countryId}`);
  return [
    {
      code: "GCI",
      label: "Governance capacity index",
      value: 30 + Math.round(rng() * 60),
      unit: "/100",
      year: 2024,
      trend: rng() > 0.5 ? "up" : "down",
    },
    {
      code: "V2X",
      label: "V-Dem liberal democracy",
      value: parseFloat((rng() * 0.9).toFixed(3)),
      unit: "score",
      year: 2024,
      trend: rng() > 0.5 ? "up" : "down",
    },
    {
      code: "GDP",
      label: "GDP per capita growth",
      value: parseFloat(((rng() - 0.3) * 8).toFixed(1)),
      unit: "% YoY",
      year: 2024,
      trend: rng() > 0.4 ? "up" : "down",
    },
    {
      code: "INF",
      label: "Inflation (CPI)",
      value: parseFloat((rng() * 25).toFixed(1)),
      unit: "%",
      year: 2024,
      trend: rng() > 0.5 ? "up" : "flat",
    },
    {
      code: "MIL",
      label: "Military expenditure",
      value: parseFloat((0.5 + rng() * 5).toFixed(1)),
      unit: "% GDP",
      year: 2023,
      trend: rng() > 0.6 ? "up" : "flat",
    },
    {
      code: "RFG",
      label: "Refugee outflows",
      value: Math.round(rng() * 500000),
      unit: "persons",
      year: 2024,
      trend: rng() > 0.5 ? "up" : "down",
    },
  ];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] tracking-widest uppercase mb-3"
      style={{ color: "var(--qgi-text-dim)" }}
    >
      {children}
    </div>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${className ?? ""}`}
      style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
    >
      {children}
    </div>
  );
}

/** Micro-bar: horizontal bar showing percentile (0–1) with color = L1 color */
function PercentileBar({
  pct,
  color,
  label,
}: {
  pct: number;
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span
        className="font-data text-[9px] w-7 text-right flex-shrink-0"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {label}
      </span>
      <div
        className="flex-1 rounded-sm overflow-hidden"
        style={{ backgroundColor: "var(--qgi-border)", height: 5 }}
      >
        <div
          style={{
            width: `${Math.round(pct * 100)}%`,
            height: "100%",
            backgroundColor: color,
            borderRadius: 2,
          }}
        />
      </div>
      <span
        className="font-data text-[9px] w-8 flex-shrink-0 tabular-nums"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {Math.round(pct * 100)}p
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CountryDossierClient({ countryId, countryData, mlStack }: Props) {
  const tier = countryData.overall_risk_tier;
  const tierMeta = TIER_META[tier];
  const topCats4 = Object.entries(countryData.tiers)
    .flatMap(([, td]) => td.top_categories.slice(0, 3))
    .sort((a, b) => (b.salience_score ?? b.z_score) - (a.salience_score ?? a.z_score))
    .slice(0, 4);
  const recentEvents = mockRecentEvents(countryId, tier); // MOCK
  const indicators = mockIndicators(countryId); // MOCK

  // Top-line score for display
  const topScore = topCats4[0];
  const topSalience = topScore ? (topScore.salience_score ?? topScore.z_score) : 0;

  const tierOrder = ["S", "M", "L", "XL"];
  const tierEntries = tierOrder
    .map((t) => ({ tier: t, data: countryData.tiers[t] }))
    .filter((e) => e.data && e.data.top_categories.length > 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* ------------------------------------------------------------------ */}
      {/* Breadcrumb + back                                                   */}
      {/* ------------------------------------------------------------------ */}
      <nav className="mb-6 text-[10px]" style={{ color: "var(--qgi-text-dim)" }}>
        <Link href="/countries-v2-table" style={{ color: "var(--qgi-text-dim)" }}>
          ← Country table
        </Link>
        <span className="mx-2">·</span>
        <Link href={`/countries/${countryId}`} style={{ color: "var(--qgi-text-dim)" }}>
          V1 profile →
        </Link>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <header className="mb-8 flex items-start gap-5">
        <CountryFlag
          alpha2={countryData.alpha_2}
          size={36}
          countryName={countryData.name}
        />
        <div className="flex-1">
          <h1
            className="text-2xl font-semibold mb-1"
            style={{ color: "var(--qgi-text)" }}
          >
            {countryData.name}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="font-data font-semibold tracking-wider px-2 py-0.5 rounded text-[11px]"
              style={{
                color: tierMeta.color,
                backgroundColor: tierMeta.bg,
                border: `1px solid ${tierMeta.border}`,
              }}
            >
              {tierMeta.label}
            </span>
            {topScore && (
              <span className="text-xs" style={{ color: "var(--qgi-text-muted)" }}>
                Top signal:{" "}
                <span style={{ color: "var(--qgi-text)" }}>{topScore.category}</span>{" "}
                <span className="font-data">({topSalience.toFixed(2)} salience)</span>
              </span>
            )}
            {!countryData.curated && (
              <span
                className="font-data text-[9px] px-1.5 py-0.5 rounded"
                style={{
                  color: "var(--qgi-text-dim)",
                  border: "1px solid var(--qgi-border)",
                }}
              >
                uncurated
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Tier breakdown (S/M/L/XL)                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8">
        <SectionLabel>Risk tier breakdown</SectionLabel>
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-xs rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--qgi-border)" }}
          >
            <thead>
              <tr style={{ backgroundColor: "var(--qgi-surface)" }}>
                {[
                  "Tier",
                  "Category",
                  "Salience",
                  "Severity",
                  "RRF rank",
                  "Last event",
                ].map((h, i) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-[10px] tracking-widest uppercase text-left"
                    style={{
                      color: "var(--qgi-text-dim)",
                      borderBottom: "1px solid var(--qgi-border)",
                      textAlign: i >= 2 ? "right" : "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tierEntries.flatMap(({ tier: t, data }) =>
                data!.top_categories.slice(0, 5).map((cat, catIdx) => (
                  <tr
                    key={`${t}-${catIdx}`}
                    style={{ borderTop: "1px solid var(--qgi-border)" }}
                    className="hover:bg-[var(--qgi-surface)] transition-colors"
                  >
                    {catIdx === 0 ? (
                      <td
                        className="px-3 py-2 font-data font-semibold text-[11px] whitespace-nowrap"
                        style={{ color: "var(--qgi-text-dim)" }}
                        rowSpan={Math.min(5, data!.top_categories.length)}
                      >
                        {t}
                      </td>
                    ) : null}
                    <td className="px-3 py-2" style={{ color: "var(--qgi-text)" }}>
                      {cat.category}
                    </td>
                    <td
                      className="px-3 py-2 font-data tabular-nums text-right"
                      style={{ color: "var(--qgi-text-muted)" }}
                    >
                      {(cat.salience_score ?? cat.z_score).toFixed(3)}
                    </td>
                    <td
                      className="px-3 py-2 font-data tabular-nums text-right"
                      style={{ color: "var(--qgi-text-muted)" }}
                    >
                      {cat.severity_tier}
                    </td>
                    <td
                      className="px-3 py-2 font-data tabular-nums text-right"
                      style={{ color: "var(--qgi-text-muted)" }}
                    >
                      #{cat.rrf_rank}
                    </td>
                    <td
                      className="px-3 py-2 font-data tabular-nums text-right"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      {cat.last_event_year ?? "—"}
                    </td>
                  </tr>
                ))
              )}
              {tierEntries.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-xs"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    No tier data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Per-L1 percentile micro-bars (MOCK percentiles)          */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8">
        <SectionLabel>
          L1 dimension profile{" "}
          <span
            style={{
              fontVariantCaps: "normal",
              textTransform: "none",
              letterSpacing: 0,
              color: "var(--qgi-text-dim)",
            }}
          >
            — percentile rank within global distribution (preview)
          </span>
        </SectionLabel>
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {L1_IDS.map((l1) => {
              const meta = L1_META[l1];
              const pct = mockL1Percentile(countryId, l1); // MOCK
              return (
                <PercentileBar key={l1} pct={pct} color={meta.color} label={meta.label} />
              );
            })}
          </div>
          <p className="text-[9px] mt-4" style={{ color: "var(--qgi-text-dim)" }}>
            Bar position = percentile rank within global L1 distribution. Higher = more
            salient than peers on that dimension. Countries with {"<"}4 unique L1 values
            will show compressed bars until corpus enrichment. Values above are preview
            data — will be computed from per-L1 salience scores once data integration
            lands.
          </p>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: ML recipe coverage matrix                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8">
        <SectionLabel>
          ML recipe coverage — 13 validated recipes{" "}
          <span
            style={{ fontVariantCaps: "normal", textTransform: "none", letterSpacing: 0 }}
          >
            anchor-stability values are preview data
          </span>
        </SectionLabel>
        <div
          className="rounded-lg border overflow-x-auto"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <table className="w-full border-collapse text-xs" style={{ minWidth: 560 }}>
            <thead>
              <tr style={{ backgroundColor: "var(--qgi-surface)" }}>
                {[
                  "Recipe",
                  "Arch",
                  "LOCO AUC",
                  "AHI (this country)",
                  "Global percentile",
                  "Status",
                ].map((h, i) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-[10px] tracking-widest uppercase text-left"
                    style={{
                      color: "var(--qgi-text-dim)",
                      borderBottom: "1px solid var(--qgi-border)",
                      textAlign: i >= 2 ? "right" : "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_LOCKED_RECIPES.map((recipe, i) => {
                const stackEntry = mlStack?.recipes.find(
                  (r) => r.recipe_id === recipe.id
                );
                const cov = mockRecipeCoverage(countryId, recipe.id); // MOCK
                const locoAuc = stackEntry?.loco_auc ?? null;
                const arch = stackEntry?.architecture ?? "—";
                const advisoryOnly = stackEntry?.advisory_only_flag ?? false;
                const tier = stackEntry?.tier ?? null;
                const tierColors: Record<string, string> = {
                  STRONG: "#22c55e",
                  MODERATE: "#fbbf24",
                  MARGINAL: "#a3a3a3",
                };
                return (
                  <tr
                    key={recipe.id}
                    style={{
                      borderTop: i === 0 ? undefined : "1px solid var(--qgi-border)",
                    }}
                    className="hover:bg-[var(--qgi-surface)] transition-colors"
                  >
                    <td className="px-3 py-2">
                      <div style={{ color: "var(--qgi-text)" }}>{recipe.label}</div>
                      {advisoryOnly && (
                        <div
                          className="font-data text-[9px] mt-0.5"
                          style={{ color: "#a16207" }}
                        >
                          Composite-only
                        </div>
                      )}
                    </td>
                    <td
                      className="px-3 py-2 font-data text-[10px]"
                      style={{ color: "var(--qgi-text-dim)", textAlign: "right" }}
                    >
                      {arch}
                    </td>
                    <td
                      className="px-3 py-2 font-data tabular-nums text-[11px]"
                      style={{
                        color:
                          locoAuc != null
                            ? tier
                              ? tierColors[tier]
                              : "var(--qgi-text-muted)"
                            : "var(--qgi-text-dim)",
                        textAlign: "right",
                      }}
                    >
                      {locoAuc != null ? locoAuc.toFixed(3) : "—"}
                    </td>
                    <td
                      className="px-3 py-2 font-data tabular-nums text-[11px]"
                      style={{
                        color: cov.covered
                          ? "var(--qgi-text-muted)"
                          : "var(--qgi-text-dim)",
                        textAlign: "right",
                      }}
                    >
                      {cov.covered ? cov.ahi!.toFixed(3) : "not measured"}
                    </td>
                    <td
                      className="px-3 py-2 font-data tabular-nums"
                      style={{
                        color: "var(--qgi-text-dim)",
                        textAlign: "right",
                        fontSize: 10,
                      }}
                    >
                      {cov.covered ? `${cov.percentile}p` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="font-data text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          color: cov.covered ? "#22c55e" : "var(--qgi-text-dim)",
                          backgroundColor: cov.covered
                            ? "rgba(34,197,94,0.10)"
                            : "transparent",
                          border: `1px solid ${cov.covered ? "rgba(34,197,94,0.30)" : "var(--qgi-border)"}`,
                        }}
                      >
                        {cov.covered ? "measured" : "no anchor"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] mt-2" style={{ color: "var(--qgi-text-dim)" }}>
          LOCO AUC + architecture from ml-recipe-stack.json (real). Per-country AHI +
          global percentile: MOCK (anchor battery v3 pending #649). &quot;Not
          measured&quot; = no anchor case in v2 regression suite for this recipe.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Recent events (MOCK)                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8">
        <SectionLabel>
          Recent events (12 months){" "}
          <span
            style={{ fontVariantCaps: "normal", textTransform: "none", letterSpacing: 0 }}
          >
            — preview data
          </span>
        </SectionLabel>
        <Card>
          <div className="space-y-3">
            {recentEvents.map((ev, i) => (
              <div
                key={i}
                className="flex items-start gap-3 pb-3"
                style={{
                  borderBottom:
                    i < recentEvents.length - 1 ? "1px solid var(--qgi-border)" : "none",
                }}
              >
                <span
                  className="font-data text-[10px] whitespace-nowrap flex-shrink-0 mt-0.5"
                  style={{ color: "var(--qgi-text-dim)", minWidth: 76 }}
                >
                  {ev.date}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-xs leading-snug"
                    style={{ color: "var(--qgi-text)" }}
                  >
                    {ev.title}
                  </div>
                  <div
                    className="text-[10px] mt-0.5"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    {ev.category}
                    {" · "}
                    <span
                      className="font-data"
                      style={{
                        color:
                          ev.severity === 3
                            ? "#f87171"
                            : ev.severity === 2
                              ? "#fbbf24"
                              : "var(--qgi-text-dim)",
                      }}
                    >
                      sev. {ev.severity}/3
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 5: Indicator panel (MOCK)                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8">
        <SectionLabel>
          Key indicators{" "}
          <span
            style={{ fontVariantCaps: "normal", textTransform: "none", letterSpacing: 0 }}
          >
            — preview data (pending V-Dem / World Bank integration)
          </span>
        </SectionLabel>
        <div
          className="rounded-lg border overflow-x-auto"
          style={{ borderColor: "var(--qgi-border)" }}
        >
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ backgroundColor: "var(--qgi-surface)" }}>
                {["Indicator", "Value", "Unit", "Year", "Trend"].map((h, i) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-[10px] tracking-widest uppercase text-left"
                    style={{
                      color: "var(--qgi-text-dim)",
                      borderBottom: "1px solid var(--qgi-border)",
                      textAlign: i >= 1 && i <= 3 ? "right" : "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indicators.map((ind, i) => (
                <tr
                  key={ind.code}
                  style={{
                    borderTop: i === 0 ? undefined : "1px solid var(--qgi-border)",
                  }}
                  className="hover:bg-[var(--qgi-surface)] transition-colors"
                >
                  <td className="px-3 py-2">
                    <div style={{ color: "var(--qgi-text)" }}>{ind.label}</div>
                    <div
                      className="font-data text-[9px]"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      {ind.code}
                    </div>
                  </td>
                  <td
                    className="px-3 py-2 font-data tabular-nums text-right"
                    style={{ color: "var(--qgi-text-muted)" }}
                  >
                    {typeof ind.value === "number" && Math.abs(ind.value) > 999
                      ? ind.value.toLocaleString()
                      : ind.value}
                  </td>
                  <td
                    className="px-3 py-2 font-data text-[10px] text-right"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    {ind.unit}
                  </td>
                  <td
                    className="px-3 py-2 font-data tabular-nums text-[10px] text-right"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    {ind.year}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      style={{
                        color:
                          ind.trend === "up"
                            ? "#f87171"
                            : ind.trend === "down"
                              ? "#34d399"
                              : "var(--qgi-text-dim)",
                        fontSize: 12,
                      }}
                    >
                      {ind.trend === "up" ? "↑" : ind.trend === "down" ? "↓" : "→"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                              */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="pt-5 text-[10px] border-t"
        style={{ color: "var(--qgi-text-dim)", borderColor: "var(--qgi-border)" }}
      >
        <p>
          V1.9.1 scoring · Composite = max(L1) per Phase 3 decision ·{" "}
          <Link href={`/countries/${countryId}`} style={{ color: "var(--qgi-text-dim)" }}>
            V1 profile →
          </Link>{" "}
          ·{" "}
          <Link href="/countries-v2-table" style={{ color: "var(--qgi-text-dim)" }}>
            ← Back to table
          </Link>{" "}
          ·{" "}
          <span style={{ color: "var(--qgi-text-muted)" }}>
            Activity, ML AHI, percentiles, events, indicators: MOCK (pre-integration)
          </span>
        </p>
      </footer>
    </div>
  );
}
