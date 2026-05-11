"use client";

import Link from "next/link";
import {
  AdvisoryOnlyCallout,
  ConcentrationAlertCallout,
  FRuleAnomalyCallout,
  InterpretationHintBadge,
  NotMeasuredHint,
  type CalloutStyle,
} from "@/components/ml/Callouts";
import type { MlRecipeEntry } from "@/lib/recipes-ml";

/**
 * V2 precedent detail page — single ML recipe tear-sheet.
 *
 * Renders all buyer-disclosure metrics from the bake script output. Caveat
 * presentation switches on `caveatStyle`:
 * - `tufte` → footnote-style annotations adjacent to the claims
 * - `lloyds` → full-width banner callouts above/below claim blocks
 *
 * Both variants render the same numeric content + the same interpretation
 * hint badge (with Ji-Hoon's parenthetical for engagement_signal).
 *
 * Per resurfacing plan §caveat presentation rules:
 * - "Not measured" AHI must be EXPLICIT TEXT (Nasrin's binding rule)
 * - ADVISORY-ONLY wired even when no current top-4 triggers
 * - F-rule anomaly wired even when no current top-4 triggers
 * - Methodology cross-refs: Section 5 prominent + Section 4 collapsible
 *   + pre-reg footer
 */

const TIER_COLORS: Record<MlRecipeEntry["tier"], string> = {
  STRONG: "#22c55e",
  MODERATE: "#fbbf24",
  MARGINAL: "#a3a3a3",
};

export function PrecedentsV2Detail({
  recipe,
  caveatStyle,
  generatedAt,
  paperHref,
}: {
  recipe: MlRecipeEntry;
  caveatStyle: CalloutStyle;
  generatedAt: string;
  /** External href to the Stage 5 paper Section 4 anchor for this recipe. */
  paperHref: string;
}) {
  const variantLetter: "a" | "b" = caveatStyle === "tufte" ? "a" : "b";
  const tierColor = TIER_COLORS[recipe.tier];
  return (
    <article className="p-8 max-w-3xl mx-auto">
      <BreadcrumbNav variantLetter={variantLetter} />

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
          <span className="font-data text-xs" style={{ color: "var(--qgi-text-dim)" }}>
            {recipe.architecture} architecture · Assignment confidence{" "}
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
        <h2
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Metrics
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3" data-testid="metrics-grid">
          <Metric
            label="LOCO AUC"
            value={recipe.loco_auc.toFixed(4)}
            sub={`n_pos = ${recipe.n_pos_loco}`}
          />
          <Metric
            label="In-sample F2 AUC"
            value={recipe.in_sample_f2_auc.toFixed(4)}
            sub={`[${recipe.in_sample_f2_ci_lower.toFixed(3)}, ${recipe.in_sample_f2_ci_upper.toFixed(3)}]`}
          />
          <Metric
            label="In-sample F1 ECE"
            value={recipe.in_sample_f1_ece.toFixed(4)}
            sub="overall"
          />
          <Metric
            label="Cohort ECE — high"
            value={recipe.ece_high_cohort.toFixed(4)}
            sub="binding fragile-state cohort"
          />
          <Metric label="Cohort ECE — mid" value={recipe.ece_mid_cohort.toFixed(4)} />
          <Metric label="Cohort ECE — low" value={recipe.ece_low_cohort.toFixed(4)} />
        </div>
        {recipe.zero_positive_cohort_flag && (
          <p className="text-xs mt-4" style={{ color: "var(--qgi-text-dim)" }}>
            Zero-positive cohort: {recipe.zero_positive_cohort_flag}
          </p>
        )}
      </section>

      {/* Anchor AHI — measured value or Not-measured hint */}
      <section className="mb-8">
        <h2
          className="text-xs tracking-widest uppercase mb-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Anchor AHI (per-recipe)
        </h2>
        {recipe.anchor_ahi_value !== null ? (
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
            }}
          >
            <span
              className="font-data text-2xl font-semibold"
              style={{ color: "var(--qgi-text)" }}
            >
              {recipe.anchor_ahi_value.toFixed(4)}
            </span>
            <span
              className="font-data text-xs ml-3"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              measured
            </span>
          </div>
        ) : (
          <NotMeasuredHint
            style={caveatStyle}
            status={recipe.anchor_ahi_status}
            reason={recipe.anchor_ahi_reason}
          />
        )}
      </section>

      {/* Mechanism narrative — full text */}
      <section className="mb-8">
        <h2
          className="text-xs tracking-widest uppercase mb-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Mechanism
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text)" }}>
          {recipe.mechanism_narrative}
        </p>
      </section>

      {/* Buyer-disclosure recommendation */}
      <section className="mb-8">
        <h2
          className="text-xs tracking-widest uppercase mb-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Buyer-disclosure recommendation
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text)" }}>
          <MarkdownBoldText text={recipe.buyer_disclosure_recommendation} />
        </p>
      </section>

      {/* Top-K SHAP indicator fingerprint */}
      <section className="mb-8">
        <h2
          className="text-xs tracking-widest uppercase mb-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Top SHAP indicators
        </h2>
        <table className="w-full text-sm" data-testid="topk-table">
          <thead>
            <tr
              className="text-left text-xs uppercase tracking-wide"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              <th className="py-2 pr-4 font-normal">#</th>
              <th className="py-2 pr-4 font-normal">Indicator</th>
              <th className="py-2 pr-4 font-normal text-right">|SHAP|</th>
              <th className="py-2 font-normal">Note</th>
            </tr>
          </thead>
          <tbody>
            {recipe.top_k_indicators.map((tk) => (
              <tr key={tk.rank} style={{ borderTop: "1px solid var(--qgi-border)" }}>
                <td
                  className="py-2 pr-4 font-data"
                  style={{ color: "var(--qgi-text-dim)" }}
                >
                  {tk.rank}
                </td>
                <td
                  className="py-2 pr-4 font-data text-xs"
                  style={{ color: "var(--qgi-text)" }}
                >
                  {tk.indicator_id}
                </td>
                <td
                  className="py-2 pr-4 font-data text-right"
                  style={{ color: "var(--qgi-text)" }}
                >
                  {tk.mean_abs_shap.toFixed(4)}
                </td>
                <td
                  className="py-2 font-data text-xs"
                  style={{
                    color: tk.fixed_effect_suspect ? "#a16207" : "var(--qgi-text-dim)",
                  }}
                >
                  {tk.fixed_effect_suspect ? "fixed-effect suspect" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Open follow-ups */}
      {recipe.open_followups.length > 0 && (
        <section className="mb-8">
          <h2
            className="text-xs tracking-widest uppercase mb-3"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Open follow-ups
          </h2>
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
          className="cursor-pointer text-xs tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Methodology cross-ref (Stage 5 paper §4)
        </summary>
        <p
          className="text-sm leading-relaxed mt-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Full tear-sheet with cohort-stratified calibration table, pre-reg-anchored
          architecture rule, and replication signature lives in the Stage 5
          buyer-disclosure paper.{" "}
          <a
            href={paperHref}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: "var(--qgi-text)" }}
          >
            Open Stage 5 §4 (external) →
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
          Reading the {caveatStyle === "tufte" ? "Tufte-footnote" : "Lloyd's-banner"}{" "}
          variant.{" "}
          <Link
            href={
              caveatStyle === "tufte"
                ? (`/precedents-v2-b/${recipe.recipe_id}` as const)
                : (`/precedents-v2-a/${recipe.recipe_id}` as const)
            }
            className="underline"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Switch to {caveatStyle === "tufte" ? "Lloyd's banner" : "Tufte footnote"} →
          </Link>
        </p>
      </footer>
    </article>
  );
}

/**
 * Minimal markdown-bold renderer. Splits the input on `**...**` pairs and
 * wraps the inner text in `<strong>`. Keeps escaping simple (no nested
 * formatting, no links, no italic) — the bake script preserves exactly
 * one level of bold and no other markdown.
 *
 * This is intentionally NOT a full markdown parser. If the disclosure copy
 * grows to need lists / links / italics, swap to `react-markdown`.
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

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div
        className="font-data text-lg font-semibold"
        style={{ color: "var(--qgi-text)" }}
      >
        {value}
      </div>
      <div className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
        {label}
      </div>
      {sub && (
        <div
          className="text-[10px] font-data mt-0.5"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function BreadcrumbNav({ variantLetter }: { variantLetter: "a" | "b" }) {
  // Next.js typed-routes wants a literal-route string; the
  // ternary keeps each branch statically resolvable.
  return (
    <nav
      className="mb-4 text-xs"
      style={{ color: "var(--qgi-text-dim)" }}
      aria-label="Back navigation"
    >
      <Link
        href={variantLetter === "a" ? "/precedents-v2-a" : "/precedents-v2-b"}
        className="underline"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        ← Back to V2 precedents list
      </Link>
    </nav>
  );
}
