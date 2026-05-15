"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  AdvisoryOnlyCallout,
  ConcentrationAlertCallout,
  FRuleAnomalyCallout,
  InterpretationHintBadge,
  NotMeasuredHint,
  type CalloutStyle,
} from "@/components/ml/Callouts";
import type { BuyerMlRecipe } from "@/lib/buyer-view";
import { SectionLabel } from "@/components/v2/SectionLabel";

/**
 * V2 precedent detail page — single ML recipe tear-sheet.
 *
 * Consumes `BuyerMlRecipe` (NOT raw `MlRecipeEntry`) — the typed buyer-view
 * boundary handles all relabeling (slug rewrite, indicator labels, jargon,
 * architecture name). This component just lays out clean fields.
 *
 * Caveat presentation switches on `caveatStyle`:
 * - `tufte` → footnote-style annotations adjacent to claims
 * - `lloyds` → full-width banner callouts above/below claim blocks
 *
 * Per resurfacing plan §caveat presentation rules:
 * - "Not measured" anchor stability must be EXPLICIT TEXT (Nasrin's binding rule)
 * - Composite-only signal wired even when no current top-4 triggers
 * - F-rule anomaly wired even when no current top-4 triggers
 * - Methodology cross-refs: Section 5 prominent + Section 4 collapsible
 *   + methodology-lock footer
 */

const TIER_COLORS: Record<BuyerMlRecipe["tier"], string> = {
  STRONG: "#22c55e",
  MODERATE: "#fbbf24",
  MARGINAL: "#a3a3a3",
};

export function PrecedentsV2Detail({
  recipe,
  caveatStyle,
  generatedAt,
  paperHref,
  /**
   * PR-vii (2026-05-15) — back-link target. The V3 canonical caller
   * (/precedents/[slug]) passes "/precedents"; V2 archive callers pass
   * "/precedents-v2a" or "/precedents-v2b". Defaults to canonical so a
   * forgotten caller still gets correct routing.
   */
  backHref = "/precedents",
  backLabel = "← Back to precedents",
}: {
  /** Buyer-shaped recipe. The page-level loader transforms raw via `toBuyerView()`. */
  recipe: BuyerMlRecipe;
  caveatStyle: CalloutStyle;
  generatedAt: string;
  /** External href to the methodology paper anchor for this recipe. */
  paperHref: string;
  backHref?: string;
  backLabel?: string;
}) {
  const tierColor = TIER_COLORS[recipe.tier];
  return (
    <article className="p-8 max-w-3xl mx-auto">
      <BreadcrumbNav backHref={backHref} backLabel={backLabel} />

      <header className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center rounded font-data font-semibold tracking-wider px-2 py-0.5 text-xs"
            style={{
              color: tierColor,
              backgroundColor: `${tierColor}18`,
              border: `1px solid ${tierColor}40`,
            }}
          >
            {recipe.tier}
          </span>
          <span
            className="font-data text-xs"
            style={{ color: "var(--qgi-text-dim)" }}
            title={`Architecture code: ${recipe.architecture_raw}`}
          >
            {recipe.architecture_label} · Assignment confidence{" "}
            {recipe.assignment_confidence}
          </span>
        </div>
        <h1 className="text-3xl font-semibold mb-3" style={{ color: "var(--qgi-text)" }}>
          {recipe.display_name}
        </h1>
        <InterpretationHintBadge style={caveatStyle} hint={recipe.interpretation_hint} />
      </header>

      {/* §5-prominent — most-critical disclosures above the fold */}
      <section className="mb-8" data-testid="critical-disclosures">
        {recipe.advisory_only_flag && (
          <AdvisoryOnlyCallout style={caveatStyle} nPosLoco={recipe.n_pos_loco} />
        )}
        {recipe.f_rule_anomaly_flag && <FRuleAnomalyCallout style={caveatStyle} />}
        <ConcentrationAlertCallout
          style={caveatStyle}
          level={recipe.concentration_alert_level}
          country={recipe.top_1_training_country}
          share={recipe.top_1_training_country_share}
        />
      </section>

      {/* Metrics — primary buyer-disclosure numbers */}
      <section
        className="mb-8 rounded-lg p-6"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
        }}
      >
        <SectionLabel>Discrimination</SectionLabel>
        <div className="grid grid-cols-2 gap-6 mb-6" data-testid="metrics-grid">
          <Metric
            label="Out-of-country"
            value={recipe.loco_auc.toFixed(4)}
            sub={`${recipe.n_pos_loco} held-out positive${recipe.n_pos_loco === 1 ? "" : "s"}`}
            tooltip="Discrimination score on countries the model never saw during training (0.5 = chance, 1.0 = perfect). LOCO AUC."
          />
          <Metric
            label="In-sample"
            value={recipe.in_sample_f2_auc.toFixed(4)}
            sub={`95% CI [${recipe.in_sample_f2_ci_lower.toFixed(3)}, ${recipe.in_sample_f2_ci_upper.toFixed(3)}]`}
            tooltip="Discrimination score on the training partition. F2 AUC weights recall more than precision (5x)."
          />
        </div>
        <SectionLabel title="Average gap between predicted probability and observed frequency, in-sample. 0 = perfectly calibrated. ECE.">
          Calibration error{" "}
          <span style={{ color: "var(--qgi-text-muted)" }}>
            (target &lt; 0.02; &gt; 0.05 = unreliable)
          </span>
        </SectionLabel>
        <CalibrationTable recipe={recipe} />
        {recipe.zero_positive_cohort_flag && (
          <p className="text-xs mt-4" style={{ color: "var(--qgi-text-dim)" }}>
            Zero-positive cohort: {recipe.zero_positive_cohort_flag}
          </p>
        )}
      </section>

      {/* Anchor stability — measured value or Not-measured hint */}
      <section className="mb-8">
        <SectionLabel title="Anchor Health Index — robustness of the recipe to held-out anchor events">
          Anchor stability (per-recipe)
        </SectionLabel>
        {recipe.anchor_ahi_value !== null ? (
          <AnchorStabilityValue value={recipe.anchor_ahi_value} />
        ) : (
          <NotMeasuredHint
            style={caveatStyle}
            status={recipe.anchor_ahi_status}
            reason={recipe.anchor_ahi_reason}
          />
        )}
      </section>

      {/* Mechanism narrative — full text (already jargon-cleaned by buyer-view) */}
      <section className="mb-8">
        <SectionLabel>Mechanism</SectionLabel>
        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text)" }}>
          {recipe.mechanism_narrative}
        </p>
      </section>

      {/* Buyer-disclosure recommendation (already jargon-cleaned by buyer-view) */}
      <section className="mb-8">
        <SectionLabel>Buyer-disclosure recommendation</SectionLabel>
        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text)" }}>
          <MarkdownBoldText text={recipe.buyer_disclosure_recommendation} />
        </p>
      </section>

      {/* Top indicators — friendly labels from buyer-view */}
      <section className="mb-8">
        <SectionLabel>Top indicators</SectionLabel>
        <table className="w-full text-sm" data-testid="topk-table">
          <thead>
            <tr
              className="text-left text-[10px] tracking-wide"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              <th className="py-2 pr-4 font-normal">#</th>
              <th className="py-2 pr-4 font-normal">Indicator</th>
              <th
                className="py-2 pr-4 font-normal text-right"
                title="Mean absolute SHAP value — how much this indicator moves the model's prediction across the training set"
              >
                Importance
              </th>
              <th className="py-2 font-normal">Note</th>
            </tr>
          </thead>
          <tbody>
            {recipe.indicators.map((ind) => (
              <tr key={ind.rank} style={{ borderTop: "1px solid var(--qgi-border)" }}>
                <td
                  className="py-2 pr-4 font-data"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {ind.rank}
                </td>
                <td
                  className="py-2 pr-4 text-xs"
                  style={{ color: "var(--qgi-text)" }}
                  title={ind.raw_id}
                >
                  {ind.label}
                </td>
                <td
                  className="py-2 pr-4 font-data text-right"
                  style={{ color: "var(--qgi-text)" }}
                >
                  {ind.importance.toFixed(4)}
                </td>
                <td
                  className="py-2 text-xs"
                  style={{
                    color: ind.country_bias_caveat ? "#a16207" : "var(--qgi-text-dim)",
                  }}
                  title={
                    ind.country_bias_caveat
                      ? "This indicator may be acting as a country-level identifier (picking up time-invariant country characteristics) rather than a true causal signal — interpret with country-specific bias caveat. Fixed-effect suspect."
                      : undefined
                  }
                >
                  {ind.country_bias_caveat ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Open follow-ups (already jargon-cleaned by buyer-view) */}
      {recipe.open_followups.length > 0 && (
        <section className="mb-8">
          <SectionLabel>Open follow-ups</SectionLabel>
          <ul className="text-sm space-y-2">
            {recipe.open_followups.map((f, i) => (
              <li key={i} style={{ color: "var(--qgi-text)" }}>
                {f}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* §4-collapsible methodology cross-ref (lazy-loaded via external link) */}
      <details className="mb-6" data-testid="methodology-collapsible">
        <summary
          className="cursor-pointer text-[11px] tracking-wide mb-2 font-medium"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Methodology cross-ref (paper §4)
        </summary>
        <p
          className="text-sm leading-relaxed mt-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Full tear-sheet with cohort-stratified calibration table, methodology-locked
          architecture rule, and replication signature lives in the buyer-disclosure
          paper.{" "}
          <a
            href={paperHref}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: "var(--qgi-text)" }}
          >
            Open paper §4 (external) →
          </a>
        </p>
      </details>

      {/* Footer — model version + variant cross-link + generated_at */}
      <footer
        className="pt-6 mt-12 text-xs"
        style={{
          color: "var(--qgi-text-dim)",
          borderTop: "1px solid var(--qgi-border)",
        }}
      >
        <p className="mb-1">
          Model version: <span className="font-data">{recipe.model_version}</span>
        </p>
        <p className="mb-1">
          Generated <span className="font-data">{generatedAt}</span>.
        </p>
        <p>
          {caveatStyle === "tufte" ? "Compact view" : "Banner view"}.{" "}
          <Link
            href={
              caveatStyle === "tufte"
                ? (`/precedents-v2b/${recipe.recipe_id}` as const)
                : (`/precedents-v2a/${recipe.recipe_id}` as const)
            }
            className="underline"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Switch to {caveatStyle === "tufte" ? "banner view" : "compact view"} →
          </Link>
        </p>
      </footer>
    </article>
  );
}

/**
 * Minimal markdown-bold renderer. Splits input on `**...**` and wraps the
 * inner text in `<strong>`. Bake writes at most one level of bold; no other
 * markdown. Swap to `react-markdown` if disclosure copy needs more.
 */
function MarkdownBoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i}>{p.slice(2, -2)}</strong>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function Metric({
  label,
  value,
  sub,
  tooltip,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Native `title` tooltip — buyer-facing label glosses for analyst readers. */
  tooltip?: string;
}) {
  return (
    <div>
      {/* Value is the primary glyph — Tufte-style data-ink priority. */}
      <div
        className="font-data text-3xl font-semibold leading-tight"
        style={{ color: "var(--qgi-text)" }}
      >
        {value}
      </div>
      {/* Label muted: 11px tracked sentence-case. */}
      <div
        className="text-[11px] tracking-wide mt-1"
        style={{ color: "var(--qgi-text-dim)" }}
        title={tooltip}
      >
        {label}
      </div>
      {sub && (
        <div
          className="text-[10px] font-data mt-0.5"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/**
 * Tier-stratified calibration error table. Per Phase A2 (Elif P0): replaces
 * 4 stacked metric tiles that repeated "Calibration —" prefix 4× wasting
 * data-ink. Compact 4-row inline table.
 */
function CalibrationTable({ recipe }: { recipe: BuyerMlRecipe }) {
  const rows: Array<{ tier: string; value: number; note?: string }> = [
    { tier: "Overall", value: recipe.in_sample_f1_ece },
    {
      tier: "High",
      value: recipe.ece_high_cohort,
      note: "fragile-state cohort",
    },
    { tier: "Mid", value: recipe.ece_mid_cohort },
    { tier: "Low", value: recipe.ece_low_cohort },
  ];
  return (
    <table
      className="w-full text-sm font-data"
      data-testid="calibration-table"
      style={{ borderCollapse: "collapse" }}
    >
      <tbody>
        {rows.map((r) => {
          const status = r.value <= 0.02 ? "good" : r.value <= 0.05 ? "warn" : "bad";
          const valueColor =
            status === "good"
              ? "var(--qgi-text)"
              : status === "warn"
                ? "#a16207"
                : "#b91c1c";
          return (
            <tr key={r.tier} style={{ borderTop: "1px solid var(--qgi-border)" }}>
              <td
                className="py-1.5 pr-4 text-xs"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {r.tier}
                {r.note && (
                  <>
                    {/* Explicit text-node space — innerText concat artifact
                        fix per Phase A2 (margin-left only provides visual
                        space). */}{" "}
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--qgi-text-muted)" }}
                    >
                      {r.note}
                    </span>
                  </>
                )}
              </td>
              <td
                className="py-1.5 text-right tabular-nums"
                style={{ color: valueColor }}
              >
                {r.value.toFixed(4)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Anchor stability value display with scale-anchor context. Per Phase A2
 * (Yuki/Sipho convergent): "0.1052 measured" is a number with no threshold
 * — buyers can't tell if it's good or bad without it. Apply Sipho's
 * suggested thresholds: < 0.15 = stable, 0.15-0.25 = caution, > 0.25 =
 * unstable. Colored dot signals status without crowding.
 */
function AnchorStabilityValue({ value }: { value: number }) {
  const status: "stable" | "caution" | "unstable" =
    value <= 0.15 ? "stable" : value <= 0.25 ? "caution" : "unstable";
  const statusColor =
    status === "stable" ? "#16a34a" : status === "caution" ? "#a16207" : "#b91c1c";
  const statusLabel =
    status === "stable" ? "stable" : status === "caution" ? "caution" : "unstable";
  return (
    <div className="flex items-baseline gap-3">
      <span
        className="font-data text-3xl font-semibold leading-tight tabular-nums"
        style={{ color: "var(--qgi-text)" }}
      >
        {value.toFixed(4)}
      </span>
      <span
        className="inline-flex items-center gap-1.5 text-[11px] tracking-wide"
        style={{ color: statusColor }}
        title="Backtest variance across held-out anchor folds. Thresholds: < 0.15 stable; 0.15–0.25 caution; > 0.25 unstable."
      >
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: statusColor }}
        />
        {statusLabel}
      </span>
      <span className="text-[10px] font-data" style={{ color: "var(--qgi-text-muted)" }}>
        threshold 0.15 stable / 0.25 unstable
      </span>
    </div>
  );
}

function BreadcrumbNav({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <nav
      className="mb-4 text-xs"
      style={{ color: "var(--qgi-text-dim)" }}
      aria-label="Back navigation"
    >
      <Link
        href={backHref as Route}
        className="underline"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {backLabel}
      </Link>
    </nav>
  );
}
