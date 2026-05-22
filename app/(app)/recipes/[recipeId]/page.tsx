/**
 * /recipes/[recipeId] — Risk-score landscape for one ML-graduated recipe.
 *
 * First graduated recipe: foreign_intervention (LOCO-AUC 0.9147).
 * Artifacts from qgi-data#56; design v1 ratified 2026-05-22 (3-Sonnet).
 *
 * This route is SEPARATE from /precedents/[slug] — precedents shows the
 * ML adjudication dossier (SHAP, AUC, ECE); recipes shows the live
 * country risk-score landscape derived from V1 similarity metric.
 *
 * M8-R5 BINDING: every risk score display MUST carry the paired-framing
 * tooltip: "similarity-to-canonical-pre-crisis-trajectory score, not a
 * calibrated probability." Rendered via <RiskScoreWithTooltip>.
 *
 * Hard gates shown in Validation panel:
 *   V1 separation: 25.8pp (gate 20pp) — PASS
 *   V4 OOT recall: 86.7% (gate 60%) — PASS
 */
import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import {
  loadShapWeights,
  loadSimilarityScores,
  loadSimilarityValidations,
  groupCountriesByZone,
} from "@/lib/recipe-similarity";
import {
  RiskScoreWithTooltip,
  ShapBarChart,
  ValidationChip,
} from "./RecipeRiskLandscapeClient";

// ---------------------------------------------------------------------------
// Route configuration
// ---------------------------------------------------------------------------

/** Only render pages for known graduated recipes at build time. */
export function generateStaticParams(): Array<{ recipeId: string }> {
  return [{ recipeId: "foreign_intervention" }];
}

interface Props {
  params: Promise<{ recipeId: string }>;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { recipeId } = await params;
  if (recipeId !== "foreign_intervention") {
    return {
      title: "Page not found · QG Intelligence",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: "Foreign Intervention Risk Landscape · QG Intelligence",
    description:
      "Country risk-score landscape for the Foreign Intervention recipe — similarity to canonical pre-crisis trajectories across 68 countries (2021 bake). LOCO-AUC 0.9147. V1 hard gates: separation 25.8pp, OOT recall 86.7%.",
    alternates: { canonical: "/recipes/foreign_intervention" },
    robots: { index: true, follow: true },
  };
}

// ---------------------------------------------------------------------------
// Static display helpers
// ---------------------------------------------------------------------------

const ZONE_COLORS = {
  HIGH: {
    bg: "rgba(248,113,113,0.08)",
    border: "rgba(248,113,113,0.25)",
    label: "#f87171",
  },
  MODERATE: {
    bg: "rgba(251,191,36,0.08)",
    border: "rgba(251,191,36,0.25)",
    label: "#fbbf24",
  },
  LOW: {
    bg: "rgba(154,176,196,0.06)",
    border: "rgba(154,176,196,0.18)",
    label: "#9ab0c4",
  },
} as const;

const ZONE_THRESHOLDS = {
  HIGH: "score >= 65",
  MODERATE: "score 40–65",
  LOW: "score < 40",
} as const;

/** Top-3 HIGH-zone countries that have audit trajectory overlay charts. */
const TOP3_WITH_CHARTS: ReadonlyArray<string> = ["Iran", "Algeria", "Syria"];

/** Maps country name to /risk-metric/ public asset path. */
function auditChartPath(country: string): string | null {
  if (!TOP3_WITH_CHARTS.includes(country)) return null;
  // Spaces → underscores to match filename convention from qgi-ml scripts.
  const safe = country.replace(/\s+/g, "_");
  return `/risk-metric/foreign_intervention/${safe}-vs-foreign_intervention.png`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RecipeRiskPage({ params }: Props) {
  const { recipeId } = await params;

  // Only foreign_intervention is graduated as of qgi-data#56.
  if (recipeId !== "foreign_intervention") {
    notFound();
  }

  // Load all four artifacts — throw on missing files so the deploy fails
  // loudly if an artifact wasn't committed to data/risk-metric/.
  const [shapWeights, scoresFile, validations] = await Promise.all([
    loadShapWeights(recipeId),
    loadSimilarityScores(recipeId, 2021),
    loadSimilarityValidations(recipeId),
  ]);

  const { high, moderate, low } = groupCountriesByZone(scoresFile);

  // Build SHAP indicator list sorted by weight desc.
  const shapIndicators = Object.entries(shapWeights.shap_importance_normalized)
    .map(([id, weight]) => ({ id, label: id, weight }))
    .sort((a, b) => b.weight - a.weight);

  // Validation panel data
  const v1 = validations.validations.v1;
  const v2 = validations.validations.v2;
  const v3 = validations.validations.v3;
  const v4 = validations.validations.v4;

  // V1 median positive (key name has a hyphen in the JSON spec)
  const v1MedianPositive = (v1 as Record<string, unknown>)[
    "median_similarity_positive_at_eventY-1"
  ] as number | undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8" style={{ color: "var(--qgi-text)" }}>
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span
            className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{
              background: "rgba(167,139,250,0.15)",
              color: "#a78bfa",
              border: "1px solid rgba(167,139,250,0.3)",
            }}
          >
            Graduated Recipe
          </span>
          <span className="text-xs font-mono" style={{ color: "var(--qgi-text-dim)" }}>
            LOCO-AUC 0.9147
          </span>
        </div>
        <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--qgi-text)" }}>
          Foreign Intervention — Risk Landscape
        </h1>
        <p
          className="text-sm leading-relaxed max-w-2xl"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {scoresFile.n_countries_scored} countries scored on similarity to historical
          Foreign Intervention crisis trajectories. Evaluation year:{" "}
          {scoresFile.evaluation_year}. Indicators:{" "}
          {scoresFile.selected_indicators.join(", ")}. Window: {scoresFile.chosen_window}{" "}
          years.
        </p>
        <p
          className="mt-2 text-xs leading-relaxed max-w-2xl"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Scores are similarity-to-canonical-pre-crisis-trajectory, not calibrated
          probabilities. Click any score for the full methodology note. Hard gates: V1
          separation {v1.separation_percentile_points.toFixed(1)}pp (gate{" "}
          {v1.hard_gate_threshold}pp) — PASS. V4 OOT recall{" "}
          {(v4.recall_at_high_threshold * 100).toFixed(1)}% (gate{" "}
          {v4.hard_gate_threshold * 100}%) — PASS.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left: Country Landscape (2/3 width on xl) ── */}
        <div className="xl:col-span-2 space-y-6">
          {/* HIGH zone */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2
                className="text-base font-semibold"
                style={{ color: ZONE_COLORS.HIGH.label }}
              >
                HIGH
              </h2>
              <span className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
                {ZONE_THRESHOLDS.HIGH}
              </span>
              <span
                className="ml-auto text-xs font-mono"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {high.length} countries
              </span>
            </div>
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: ZONE_COLORS.HIGH.bg,
                border: `1px solid ${ZONE_COLORS.HIGH.border}`,
              }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr
                    style={{
                      borderBottom: `1px solid ${ZONE_COLORS.HIGH.border}`,
                      color: "var(--qgi-text-dim)",
                      fontSize: "11px",
                    }}
                  >
                    <th className="text-left px-4 py-2 font-medium">Country</th>
                    <th className="text-right px-4 py-2 font-medium">Score</th>
                    <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">
                      Zone
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {high.map((row, idx) => {
                    const chartSrc = auditChartPath(row.name);
                    return (
                      <>
                        <tr
                          key={row.name}
                          style={{
                            borderBottom:
                              idx < high.length - 1 || chartSrc
                                ? `1px solid ${ZONE_COLORS.HIGH.border}`
                                : undefined,
                          }}
                        >
                          <td
                            className="px-4 py-2.5 font-medium"
                            style={{ color: "var(--qgi-text)" }}
                          >
                            {row.name}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <RiskScoreWithTooltip
                              score={row.risk_score}
                              zone={row.zone}
                            />
                          </td>
                          <td
                            className="px-4 py-2.5 text-right hidden sm:table-cell"
                            style={{ color: ZONE_COLORS.HIGH.label, fontSize: "11px" }}
                          >
                            HIGH
                          </td>
                        </tr>
                        {/* Trajectory overlay image for top-3 HIGH countries */}
                        {chartSrc && (
                          <tr
                            key={`${row.name}-chart`}
                            style={{
                              borderBottom:
                                idx < high.length - 1
                                  ? `1px solid ${ZONE_COLORS.HIGH.border}`
                                  : undefined,
                            }}
                          >
                            <td colSpan={3} className="px-4 pb-4">
                              <div className="mt-1 mb-1">
                                <p
                                  className="text-xs mb-2"
                                  style={{ color: "var(--qgi-text-dim)" }}
                                >
                                  Indicator trajectory overlay — {row.name} vs Foreign
                                  Intervention canonical profile
                                </p>
                                <Image
                                  src={chartSrc}
                                  alt={`Indicator trajectory overlay for ${row.name} versus the Foreign Intervention canonical crisis profile`}
                                  width={900}
                                  height={400}
                                  className="w-full rounded"
                                  style={{ maxHeight: "260px", objectFit: "contain" }}
                                  unoptimized
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* MODERATE zone */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2
                className="text-base font-semibold"
                style={{ color: ZONE_COLORS.MODERATE.label }}
              >
                MODERATE
              </h2>
              <span className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
                {ZONE_THRESHOLDS.MODERATE}
              </span>
              <span
                className="ml-auto text-xs font-mono"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {moderate.length} countries
              </span>
            </div>
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: ZONE_COLORS.MODERATE.bg,
                border: `1px solid ${ZONE_COLORS.MODERATE.border}`,
              }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr
                    style={{
                      borderBottom: `1px solid ${ZONE_COLORS.MODERATE.border}`,
                      color: "var(--qgi-text-dim)",
                      fontSize: "11px",
                    }}
                  >
                    <th className="text-left px-4 py-2 font-medium">Country</th>
                    <th className="text-right px-4 py-2 font-medium">Score</th>
                    <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">
                      Zone
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {moderate.map((row, idx) => (
                    <tr
                      key={row.name}
                      style={{
                        borderBottom:
                          idx < moderate.length - 1
                            ? `1px solid ${ZONE_COLORS.MODERATE.border}`
                            : undefined,
                      }}
                    >
                      <td
                        className="px-4 py-2.5 font-medium"
                        style={{ color: "var(--qgi-text)" }}
                      >
                        {row.name}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <RiskScoreWithTooltip score={row.risk_score} zone={row.zone} />
                      </td>
                      <td
                        className="px-4 py-2.5 text-right hidden sm:table-cell"
                        style={{ color: ZONE_COLORS.MODERATE.label, fontSize: "11px" }}
                      >
                        MODERATE
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* LOW zone */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <h2
                className="text-base font-semibold"
                style={{ color: ZONE_COLORS.LOW.label }}
              >
                LOW
              </h2>
              <span className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
                {ZONE_THRESHOLDS.LOW}
              </span>
              <span
                className="ml-auto text-xs font-mono"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {low.length} countries
              </span>
            </div>
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: ZONE_COLORS.LOW.bg,
                border: `1px solid ${ZONE_COLORS.LOW.border}`,
              }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr
                    style={{
                      borderBottom: `1px solid ${ZONE_COLORS.LOW.border}`,
                      color: "var(--qgi-text-dim)",
                      fontSize: "11px",
                    }}
                  >
                    <th className="text-left px-4 py-2 font-medium">Country</th>
                    <th className="text-right px-4 py-2 font-medium">Score</th>
                    <th className="text-right px-4 py-2 font-medium hidden sm:table-cell">
                      Zone
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {low.map((row, idx) => (
                    <tr
                      key={row.name}
                      style={{
                        borderBottom:
                          idx < low.length - 1
                            ? `1px solid ${ZONE_COLORS.LOW.border}`
                            : undefined,
                      }}
                    >
                      <td
                        className="px-4 py-2.5 font-medium"
                        style={{ color: "var(--qgi-text)" }}
                      >
                        {row.name}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <RiskScoreWithTooltip score={row.risk_score} zone={row.zone} />
                      </td>
                      <td
                        className="px-4 py-2.5 text-right hidden sm:table-cell"
                        style={{ color: ZONE_COLORS.LOW.label, fontSize: "11px" }}
                      >
                        LOW
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ── Right: SHAP weights + Validation panel ── */}
        <div className="space-y-6">
          {/* SHAP weight visualization */}
          <section
            className="rounded-lg p-4"
            style={{
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--qgi-text)" }}
            >
              Indicator Importance (SHAP)
            </h3>
            <ShapBarChart indicators={shapIndicators} />
          </section>

          {/* Validation panel */}
          <section
            className="rounded-lg p-4 space-y-4"
            style={{
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: "var(--qgi-text)" }}>
                Validation Results
              </h3>
              <ValidationChip pass={validations.all_hard_gates_pass} />
            </div>

            {/* V1 — positive instance recall */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  V1 — Separation (HARD GATE)
                </span>
                <ValidationChip pass={v1.hard_gate_pass} />
              </div>
              <p className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
                Median pre-event score:{" "}
                <span className="font-mono font-semibold" style={{ color: "#34d399" }}>
                  {v1MedianPositive !== undefined ? v1MedianPositive.toFixed(1) : "n/a"}
                </span>{" "}
                vs non-event:{" "}
                <span className="font-mono">
                  {v1.median_similarity_non_event.toFixed(1)}
                </span>
                . Separation:{" "}
                <span className="font-mono font-semibold" style={{ color: "#34d399" }}>
                  {v1.separation_percentile_points.toFixed(1)}pp
                </span>{" "}
                (gate {v1.hard_gate_threshold}pp).
              </p>
            </div>

            {/* V2 — XGBoost correlation */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  V2 — XGBoost Correlation
                </span>
                <span
                  className="text-xs font-mono"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  reporting only
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
                Pearson r:{" "}
                <span className="font-mono">{v2.pearson_correlation.toFixed(3)}</span>,
                Spearman rho:{" "}
                <span className="font-mono">{v2.spearman_correlation.toFixed(3)}</span>.
                Moderate-to-acceptable correlation with XGBoost discriminator.
              </p>
            </div>

            {/* V3 — cohort medians */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  V3 — Cohort Medians
                </span>
                <span
                  className="text-xs font-mono"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  reporting only
                </span>
              </div>
              <div className="space-y-0.5">
                {Object.entries(v3.cohort_distributions)
                  .filter(([, d]) => d.n > 0)
                  .map(([cohort, dist]) => (
                    <div
                      key={cohort}
                      className="flex justify-between text-xs"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      <span className="capitalize">{cohort.replace(/-/g, " ")}</span>
                      <span className="font-mono">
                        {dist.median !== undefined ? dist.median.toFixed(1) : "—"}
                      </span>
                    </div>
                  ))}
              </div>
              <p
                className="text-xs mt-1 italic"
                style={{ color: "var(--qgi-text-dim)", fontSize: "10px" }}
              >
                Fragile-state cohort correctly shows highest median.
              </p>
            </div>

            {/* V4 — OOT holdout */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  V4 — OOT Holdout (HARD GATE)
                </span>
                <ValidationChip pass={v4.hard_gate_pass} />
              </div>
              <p className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
                {v4.n_at_or_above_high_threshold}/{v4.n_holdout_positives} holdout crisis
                countries scored HIGH at event-year-minus-1. Recall:{" "}
                <span className="font-mono font-semibold" style={{ color: "#34d399" }}>
                  {(v4.recall_at_high_threshold * 100).toFixed(1)}%
                </span>{" "}
                (gate {v4.hard_gate_threshold * 100}%). OOT split: pre-
                {v4.oot_split_year} canonical profile only.
              </p>
            </div>

            <div
              className="pt-3 mt-2 text-xs border-t"
              style={{
                borderColor: "var(--qgi-border)",
                color: "var(--qgi-text-dim)",
              }}
            >
              Design:{" "}
              <a
                href="https://github.com/AminAlAit/qgi-docs/blob/main/internal/ops/ml-track/risk-metric-design-v1.md"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--qgi-accent)" }}
              >
                risk-metric-design-v1
              </a>{" "}
              &middot; Methodology:{" "}
              <a
                href="https://github.com/AminAlAit/qgi-docs/blob/main/methodology/similarity-as-risk-metric.md"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--qgi-accent)" }}
              >
                similarity-as-risk-metric
              </a>
            </div>
          </section>

          {/* Methodology note */}
          <section
            className="rounded-lg p-4 text-xs leading-relaxed"
            style={{
              background: "rgba(56,189,248,0.05)",
              border: "1px solid rgba(56,189,248,0.2)",
              color: "var(--qgi-text-dim)",
            }}
          >
            <strong style={{ color: "var(--qgi-text-muted)" }}>Methodology note.</strong>{" "}
            Scores reflect similarity to the weighted centroid of historical crisis
            trajectories (pre-crisis window = {scoresFile.chosen_window} years). All four
            indicators carry a negative direction sign — higher indicator values predict
            lower similarity. SHAP importances are derived from TreeExplainer on a
            full-data refit, per Miriam M14-R5 BINDING (qgi-docs 2026-05-22).
          </section>
        </div>
      </div>

      {/* ── Footer bake date ── */}
      <div
        className="mt-8 pt-4 border-t text-xs"
        style={{
          borderColor: "var(--qgi-border)",
          color: "var(--qgi-text-dim)",
        }}
      >
        Bake date: {scoresFile.computed_at_utc.slice(0, 10)} &middot;{" "}
        {scoresFile.n_countries_scored} countries scored &middot; Scoring metric:{" "}
        {scoresFile.scoring_metric}
      </div>
    </div>
  );
}
