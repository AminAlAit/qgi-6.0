"use client";

import Link from "next/link";
import { CountryFlag } from "@/components/design/CountryFlag";
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
 * V2 signal detail page — single (country, recipe) tear-sheet.
 *
 * MVP-shallow scope (#655 founder pick 2026-05-12): renders the same
 * recipe-level metrics as `/precedents-v2-{a,b}/[slug]` plus a country
 * header. The country slug doesn't drive any per-(country, year) firing
 * score today — that's a future bake. The page exists as the URL surface
 * + buyer-disclosure caveat surface; per-country probability comes later.
 *
 * The recipe-switcher in the breadcrumb lets users navigate between the
 * top-4 LOCKed recipes for the same country.
 */

const TIER_COLORS: Record<BuyerMlRecipe["tier"], string> = {
  STRONG: "#22c55e",
  MODERATE: "#fbbf24",
  MARGINAL: "#a3a3a3",
};

export function SignalsV2Detail({
  recipe,
  country,
  countryAlpha2,
  countrySlugStr,
  topRecipes,
  caveatStyle,
  generatedAt,
  paperHref,
}: {
  recipe: BuyerMlRecipe;
  country: string;
  countryAlpha2: string;
  countrySlugStr: string;
  /** All top-4 recipes for the recipe-switcher; passed from the page. */
  topRecipes: BuyerMlRecipe[];
  caveatStyle: CalloutStyle;
  generatedAt: string;
  paperHref: string;
}) {
  const variantLetter: "a" | "b" = caveatStyle === "tufte" ? "a" : "b";
  const tierColor = TIER_COLORS[recipe.tier];
  return (
    <article className="p-8 max-w-3xl mx-auto">
      <BreadcrumbNav
        variantLetter={variantLetter}
        country={country}
        countrySlugStr={countrySlugStr}
      />

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <CountryFlag alpha2={countryAlpha2} size={32} />
          <span className="text-sm" style={{ color: "var(--qgi-text-dim)" }}>
            Signal context — {country}
          </span>
        </div>
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

      {/* MVP-shallow disclosure: no per-(country, recipe) firing score yet */}
      <section
        className="mb-8 rounded-md p-4"
        style={{
          backgroundColor: "var(--qgi-surface-2)",
          border: "1px dashed var(--qgi-border)",
        }}
        data-testid="mvp-disclosure"
      >
        <p className="text-sm" style={{ color: "var(--qgi-text-dim)" }}>
          <strong>Per-country firing score:</strong> not yet baked. The recipe metrics
          below are global (out-of-country, across the 30-country held-out panel). A
          future bake will surface per-(country, year) probability for {country} against
          this recipe.
        </p>
      </section>

      {/* Recipe-level critical disclosures (same as precedents-v2 detail) */}
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

      {/* Recipe-switcher for this country */}
      <section className="mb-8">
        <SectionLabel>Other top-4 recipes for {country}</SectionLabel>
        <div className="flex flex-wrap gap-2" data-testid="recipe-switcher">
          {topRecipes
            .filter((r) => r.recipe_id !== recipe.recipe_id)
            .map((r) => {
              const href =
                caveatStyle === "tufte"
                  ? (`/signals-v2-a/${countrySlugStr}/${r.recipe_id}` as const)
                  : (`/signals-v2-b/${countrySlugStr}/${r.recipe_id}` as const);
              return (
                <Link
                  key={r.recipe_id}
                  href={href}
                  className="rounded px-3 py-1.5 text-xs"
                  style={{
                    backgroundColor: "var(--qgi-surface)",
                    border: "1px solid var(--qgi-border)",
                    color: "var(--qgi-text)",
                  }}
                >
                  {r.display_name}{" "}
                  <span className="font-data" style={{ color: "var(--qgi-text-dim)" }}>
                    ({r.tier})
                  </span>
                </Link>
              );
            })}
        </div>
      </section>

      {/* Metrics block — same shape as precedents-v2 */}
      <section
        className="mb-8 rounded-lg p-6"
        style={{
          backgroundColor: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
        }}
      >
        <SectionLabel>Discrimination (global, not country-specific)</SectionLabel>
        <div className="grid grid-cols-2 gap-6 mb-2" data-testid="metrics-grid">
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
        <div className="mt-6">
          <SectionLabel title="Average gap between predicted probability and observed frequency, in-sample. 0 = perfectly calibrated. ECE.">
            Calibration error{" "}
            <span style={{ color: "var(--qgi-text-muted)" }}>
              (target &lt; 0.02; &gt; 0.05 = unreliable)
            </span>
          </SectionLabel>
          <div className="font-data text-3xl font-semibold leading-tight tabular-nums">
            {recipe.in_sample_f1_ece.toFixed(4)}
          </div>
          <div
            className="text-[10px] font-data mt-0.5"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            overall (signals page doesn&apos;t show tier breakdown — see precedent detail)
          </div>
        </div>
      </section>

      {/* Anchor stability (per-recipe AHI) */}
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

      {/* Mechanism narrative */}
      <section className="mb-8">
        <SectionLabel>Mechanism</SectionLabel>
        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text)" }}>
          {recipe.mechanism_narrative}
        </p>
      </section>

      {/* Methodology cross-ref (collapsible) */}
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
            Open Stage 5 §4 (external) →
          </a>
        </p>
      </details>

      {/* Footer */}
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
          {/* Switch link targets the OTHER variant: condition is current
              style, branches point at the opposite to keep typed-routes
              happy (Next.js wants statically-resolvable hrefs per branch). */}
          <Link
            href={
              caveatStyle === "tufte"
                ? (`/signals-v2-b/${countrySlugStr}/${recipe.recipe_id}` as const)
                : (`/signals-v2-a/${countrySlugStr}/${recipe.recipe_id}` as const)
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
      <div
        className="font-data text-3xl font-semibold leading-tight"
        style={{ color: "var(--qgi-text)" }}
      >
        {value}
      </div>
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
 * Anchor stability value with threshold context. Mirrors precedents-v2 detail
 * (Phase A2: Yuki/Sipho convergent — number needs scale anchor).
 */
function AnchorStabilityValue({ value }: { value: number }) {
  const status: "stable" | "caution" | "unstable" =
    value <= 0.15 ? "stable" : value <= 0.25 ? "caution" : "unstable";
  const statusColor =
    status === "stable" ? "#16a34a" : status === "caution" ? "#a16207" : "#b91c1c";
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
        {status}
      </span>
      <span className="text-[10px] font-data" style={{ color: "var(--qgi-text-muted)" }}>
        threshold 0.15 stable / 0.25 unstable
      </span>
    </div>
  );
}

function BreadcrumbNav({
  variantLetter,
  country,
  countrySlugStr,
}: {
  variantLetter: "a" | "b";
  country: string;
  countrySlugStr: string;
}) {
  return (
    <nav
      className="mb-4 text-xs"
      style={{ color: "var(--qgi-text-dim)" }}
      aria-label="Back navigation"
    >
      <Link
        href={variantLetter === "a" ? "/signals-v2-a" : "/signals-v2-b"}
        className="underline"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        ← V2 signals list
      </Link>{" "}
      ·{" "}
      <span className="font-data" data-testid="country-context">
        {country} ({countrySlugStr})
      </span>
    </nav>
  );
}
