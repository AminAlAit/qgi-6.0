import Link from "next/link";
import type { Route } from "next";
import { CountryFlag } from "@/components/design/CountryFlag";
import type { RiskTier } from "@/lib/country-risks.schema";

/**
 * Country merged-detail page — Build PR #3 of 5 (A3 Family 2 merger brief).
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 2 — Countries §"Detail page composition")
 *
 * Sections shipped this PR:
 *   1. Hero (flag + name + tier pill + Sipho tooltip)
 *   2. Lloyd's tier banner
 *   3. "What's happening here" opening (preview template for unauthored)
 *   4. "What this doesn't mean" 3-bullet (country-specific)
 *   5. L1 risk profile — 8-row small-multiples (Elif fold from V1 8 cards)
 *   6. Cross-family handoffs footer
 *
 * Deferred to PR #4: ML coverage matrix · structural peers · indicator
 * trajectories · recent events density-strip · top precedents · radar.
 *
 * Server component (no client interactivity needed for PR #3; PR #4 may
 * promote sections to client when ML matrix collapse + events drawer ship).
 */

const TIER_META: Record<
  RiskTier,
  { label: string; color: string; bg: string; border: string; tooltip: string }
> = {
  HIGH: {
    label: "HIGH",
    color: "#f87171",
    bg: "rgba(248,113,113,0.10)",
    border: "rgba(248,113,113,0.35)",
    tooltip:
      "Top 20% of 156 scored countries. Composite of 71 risk-category z-scores, aggregated via max(L1) per V1.9.1 methodology. Reflects structural conditions visible in indicator data — relative position, not predictive forecast.",
  },
  MODERATE: {
    label: "MODERATE",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.35)",
    tooltip:
      "Middle band (next 30% after HIGH). At least one L1 risk dimension elevated relative to global norms. Warrants monitoring; does not indicate acute risk across the board.",
  },
  INDICATIVE: {
    label: "INDICATIVE",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.10)",
    border: "rgba(56,189,248,0.35)",
    tooltip:
      "Background level (bottom 50%). Categories scored and tracked; no single dimension currently elevated enough to move composite above MODERATE. Tier is the most stable rung.",
  },
};

const TIER_BANNER_COPY: Record<RiskTier, string> = {
  HIGH: "{country} sits at Tier HIGH — the top 20% of countries we score. This reflects structural conditions visible in indicator data; it is a relative position, not a prediction of imminent crisis.",
  MODERATE:
    "{country} sits at Tier MODERATE — the middle band, above background but below the most elevated quartile. At least one risk dimension is elevated relative to global norms.",
  INDICATIVE:
    "{country} sits at Tier INDICATIVE — the broadest band. Background signals are tracked but no single dimension is currently elevated.",
};

function formatCategory(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface MlMatrixRow {
  recipe_id: string;
  display_name: string;
  architecture_label: string;
  loco_auc: number;
  /** Expected Calibration Error overall (calibration band, REAL data). */
  ece_overall: number;
  /** Per-country AHI (preview value; null = "no anchor in battery yet"). */
  ahi_preview: number | null;
  /** Per-country global percentile (preview value; null when no anchor). */
  pct_preview: number | null;
  has_anchor: boolean;
}

export interface StructuralPeer {
  slug: string;
  name: string;
  alpha_2: string;
  tier: string;
  similarity: number;
}

/**
 * #721 (2026-05-16) — QGI Risk Score buyer-facing surface.
 *
 * Optional; absent when the bake didn't compute a score (older bakes)
 * or when the country has insufficient coverage. Spec:
 * qgi-docs/internal/ops/qgi-risk-score-majles-2026-05-16.md
 *
 * STRICT ORDINAL — NOT A PROBABILITY. Tooltip copy must reflect this.
 */
export interface QgiRiskScore {
  score: number | null;
  ci_low: number | null;
  ci_high: number | null;
  coverage_flag: "ok" | "insufficient";
}

/**
 * #729 (2026-05-16) — Per-recipe Precedent Match entry. Mirrors the
 * country-level shape + carries cohort_n + calibration metrics from the
 * ML stack. Optional fields land in v3 bakes (#729 Step 1.5).
 *
 * Distinct NAME from the aggregate: Ingrid's veto — "Precedent Match"
 * avoids the "risk-of-event" misread that "Risk Score per recipe" invites.
 */
export interface QgiPerRecipeEntry {
  score: number;
  ci_low: number;
  ci_high: number;
  coverage_flag: "ok" | "insufficient";
  cohort_n_recipe?: number;
  recipe_ece?: number | null;
  recipe_loco_auc?: number | null;
  recipe_f_rule_advisory_flag?: boolean;
  recipe_f_rule_anomaly_flag?: boolean;
}

function formatRecipeDisplayName(id: string): string {
  return id
    .replace(/_and_/g, " & ")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function CountryMergedDetail({
  iso,
  name,
  alpha_2,
  curated,
  tier,
  l1Rows,
  top3,
  mlRows = [],
  mlCovCount = 0,
  mlMatrixDefaultExpanded = false,
  structuralPeers = [],
  riskScore,
  perRecipe,
  bakeDate,
}: {
  iso: string;
  name: string;
  alpha_2: string;
  curated: boolean;
  tier: RiskTier;
  /** ISO-8601 date (YYYY-MM-DD) of the bake that produced this country's
   *  scores. Surfaced in the "What's happening here" status chip so the
   *  reader knows the data vintage without hunting for it. */
  bakeDate?: string;
  l1Rows: ReadonlyArray<{
    code: string;
    label: string;
    shortLabel: string;
    color: string;
    /** Max salience score across all tier windows for this L1 group.
     *  Null when the country has no top_category in this group. */
    salience: number | null;
  }>;
  top3: ReadonlyArray<{
    category: string;
    salience_score: number;
    l1_group: string | null;
  }>;
  /** PR #4 — ML coverage matrix rows (currently top-4 LOCKed). */
  mlRows?: ReadonlyArray<MlMatrixRow>;
  /** PR #4 — count of rows with anchor coverage (drives the default
   *  expansion gate per brief Section 4). */
  mlCovCount?: number;
  mlMatrixDefaultExpanded?: boolean;
  /** PR #4 — structural-peer cohort (top-5 by L1-profile similarity). */
  structuralPeers?: ReadonlyArray<StructuralPeer>;
  /** #721 Step 2 — QGI Risk Score (0-100 percentile rank). Optional;
   *  hero renders gracefully without it. */
  riskScore?: QgiRiskScore;
  /** #729 Step 2 — per-recipe Precedent Match block (record keyed by recipe id,
   *  null per recipe when the country has no top_category match). Optional;
   *  hidden when absent (pre-#728 bakes). */
  perRecipe?: Record<string, QgiPerRecipeEntry | null> | undefined;
}) {
  const tierMeta = TIER_META[tier];
  // Highlighted L1 groups — the codes that contain a top-3 driving category.
  // Drives the bold + caret marker on the L1 row per brief Section 3.
  const top3L1 = new Set(top3.map((c) => c.l1_group).filter((g): g is string => !!g));

  // Max salience across all L1 rows — used to normalize the salience bar.
  // Default to 1 so a country with no salience signals doesn't divide by 0.
  const maxSalience = Math.max(
    1,
    ...l1Rows.map((r) => r.salience ?? 0).filter((v) => v > 0)
  );

  return (
    <article className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
      {/* ============== Breadcrumb ============== */}
      <nav
        className="mb-6 text-[10px] tracking-widest uppercase"
        style={{ color: "var(--qgi-text-dim)" }}
        aria-label="Breadcrumb"
      >
        <Link
          href={"/countries" as Route}
          className="hover:text-[var(--qgi-text-muted)] transition-colors"
        >
          ← Countries
        </Link>
      </nav>

      {/* ============== Hero ============== */}
      {/*
        #721 (2026-05-16) — QGI Risk Score promoted to hero per Majles
        2026-05-16 synthesis. Tier pill DEMOTED to a secondary chip
        beside the score (was the H1's tagline). H1 drops "· Tier X"
        suffix — the name stands alone. Risk Score gets a dedicated
        right-side tile (3xl numeral + Sipho [Verified data] eyebrow +
        CI range below). When riskScore is absent or insufficient, the
        tier pill rides at its prior visual weight as a graceful
        fallback. See `RiskScoreHeroTile` for the score-rendering
        component.
      */}
      <header className="mb-6">
        {/* #755 (persona-test 2026-05-17, Fatima/UNDP iPhone 14 / 390px):
            long country names ("The Democratic Republic of the Congo")
            collapsed the H1 column to ~33px when the score tile occupied
            the right side at mobile, forcing the H1 to wrap across 6
            lines and overlap with the tile. Restructure the row to
            stack vertically below `md`: flag + name + tier on one row,
            score tile on its own row. Desktop layout (≥md) unchanged. */}
        <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4">
          <div className="flex items-start gap-4 min-w-0 md:flex-1">
            <CountryFlag alpha2={alpha_2} size={36} countryName={name} />
            <div className="flex-1 min-w-0">
              <h1
                className="text-3xl font-semibold leading-tight break-words"
                style={{ color: "var(--qgi-text)" }}
              >
                {name}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <TierPill meta={tierMeta} />
                {curated && (
                  <span
                    className="font-data text-[10px] tracking-wide uppercase px-2 py-0.5 rounded"
                    style={{
                      color: "var(--qgi-text-muted)",
                      border: "1px solid var(--qgi-border)",
                    }}
                    title="Curated event history available — full timeline reachable via the events section."
                  >
                    Curated event history
                  </span>
                )}
              </div>
            </div>
          </div>
          {riskScore && riskScore.coverage_flag === "ok" && (
            <RiskScoreHeroTile
              score={riskScore.score}
              ciLow={riskScore.ci_low}
              ciHigh={riskScore.ci_high}
              tierMeta={tierMeta}
            />
          )}
        </div>
      </header>

      {/* ============== Lloyd's tier banner (Section 1 of brief) ============== */}
      <section
        role="note"
        aria-label="Tier definition"
        className="mb-6 rounded-lg p-4 max-w-[68ch]"
        style={{
          backgroundColor: tierMeta.bg,
          border: `1px solid ${tierMeta.border}`,
          borderLeftWidth: 3,
        }}
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text)" }}>
          {TIER_BANNER_COPY[tier].replace("{country}", name)}
        </p>
      </section>

      {/* ============== Precedent Match strip (#729 Step 2) ============== */}
      {/*
        Per-recipe Precedent Match decomposition of the hero QGI Risk Score.
        Yuki's spec: Section 2 below hero, horizontal mini-bar-chart, 4 rows,
        single neutral palette, cohort_n visible glyph (Roshani's veto).
        Renders nothing if the bake doesn't carry the per-recipe block
        (graceful degradation for pre-#728 bakes).
      */}
      {perRecipe && Object.values(perRecipe).some((v) => v !== null) && (
        <PrecedentMatchStrip perRecipe={perRecipe} />
      )}

      {/* ============== Section "What's happening here" (Ingrid) ============== */}
      <WhatsHappeningHere name={name} tier={tier} top3={top3} bakeDate={bakeDate} />

      {/* ============== Section "What this doesn't mean" ============== */}
      <WhatThisDoesntMean name={name} />

      {/* ============== Section 3 — L1 risk profile (small-multiples) ============== */}
      <section className="mb-8" aria-labelledby="l1-profile-heading">
        <h2
          id="l1-profile-heading"
          className="text-[10px] tracking-widest uppercase mb-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          L1 risk profile
          <span
            className="ml-2 text-[9px] font-data normal-case tracking-normal"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            (8 risk dimensions; top-3 drivers highlighted)
          </span>
        </h2>
        <div
          className="rounded-lg border overflow-hidden"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          {l1Rows.map((row, idx) => (
            <L1Row
              key={row.code}
              row={row}
              maxSalience={maxSalience}
              isTopDriver={top3L1.has(row.code)}
              isLast={idx === l1Rows.length - 1}
            />
          ))}
        </div>
      </section>

      {/* ============== Section 4 — ML recipe coverage matrix (Marcus flagship) ============== */}
      {mlRows.length > 0 && (
        <MlCoverageMatrix
          rows={mlRows}
          covCount={mlCovCount}
          defaultExpanded={mlMatrixDefaultExpanded}
        />
      )}

      {/* ============== Section 5 — Structural peers ============== */}
      {structuralPeers.length > 0 && (
        <StructuralPeers peers={structuralPeers} subjectName={name} />
      )}

      {/* ============== Cross-family handoffs footer ============== */}
      <footer
        className="pt-6 border-t mt-8"
        style={{ borderColor: "var(--qgi-border)" }}
        aria-label="Cross-family handoffs"
      >
        <div
          className="text-[10px] tracking-widest uppercase mb-3"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Related across QGI
        </div>
        <div className="flex flex-col gap-2 text-sm max-w-[68ch]">
          <Link
            href={`/signals/${iso}` as Route}
            className="hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            Currently firing signals for {name} →
          </Link>
          <Link
            href={"/precedents" as Route}
            className="hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            See related precedent recipes →
          </Link>
          <Link
            href={"/patterns?sort=loco_auc" as Route}
            className="hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            See related ranked patterns →
          </Link>
          <Link
            href={`/countries/${iso}` as Route}
            className="hover:text-[var(--qgi-accent)] transition-colors"
            style={{ color: "var(--qgi-text-muted)" }}
          >
            See the V1 country profile (legacy) →
          </Link>
        </div>
        <p
          className="text-[10px] mt-5 font-data"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          V1.9.1 scoring · Composite = max(L1) per Phase 3 decision · Country ID:{" "}
          <span className="tabular-nums">{iso}</span> ·{" "}
          <Link
            href={"/methodology" as Route}
            className="underline underline-offset-2"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Methodology →
          </Link>
          {" · "}
          <span style={{ color: "var(--qgi-text-muted)" }}></span>
        </p>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TierPill({ meta }: { meta: (typeof TIER_META)[RiskTier] }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-data font-semibold tracking-wider uppercase"
      style={{
        backgroundColor: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.border}`,
      }}
      title={meta.tooltip}
    >
      {meta.label}
    </span>
  );
}

/**
 * QGI Risk Score hero tile (#721 Step 2).
 *
 * Visual primary on the country detail page hero — 3xl numeral with
 * /100 suffix, Sipho `[Verified data]` eyebrow, CI range tucked below.
 *
 * STRICT ORDINAL — NOT A PROBABILITY. Tooltip copy says so verbatim;
 * methodology page §"QGI Risk Score" has the long-form explanation.
 *
 * Color flows from the country's tier (border accent only — the
 * numeral itself stays in primary text color so the score is the
 * dominant glyph regardless of tier).
 */
function RiskScoreHeroTile({
  score,
  ciLow,
  ciHigh,
  tierMeta,
}: {
  score: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  tierMeta: (typeof TIER_META)[RiskTier];
}) {
  if (score === null) return null;
  const ciSpan = ciLow !== null && ciHigh !== null ? `${ciLow}–${ciHigh}` : null;
  return (
    <div
      className="flex flex-col items-end shrink-0 px-4 py-2 rounded-lg"
      style={{
        backgroundColor: tierMeta.bg,
        border: `1px solid ${tierMeta.border}`,
        borderTopWidth: 2,
        borderTopColor: tierMeta.color,
      }}
      title="QGI Risk Score: 0–100 percentile rank of this country's max-salience signal across the current bake's cohort. This is a percentile rank, NOT a probability. Higher scores indicate stronger structural-precedent match, not higher chance of a future event. See /methodology#qgi-risk-score."
    >
      <span
        className="text-[9px] tracking-widest uppercase font-semibold mb-0.5"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        [Verified data] QGI Risk Score
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className="text-4xl font-semibold leading-none font-data tabular-nums"
          style={{ color: "var(--qgi-text)" }}
        >
          {score}
        </span>
        <span className="text-sm font-data" style={{ color: "var(--qgi-text-dim)" }}>
          /100
        </span>
      </div>
      {ciSpan && (
        <span
          className="text-[10px] mt-1 font-data tabular-nums"
          style={{ color: "var(--qgi-text-muted)" }}
          title={`95% bootstrap confidence interval: ${ciSpan} of 100. Bootstrap resamples the bake's cohort 1000 times with a deterministic seed.`}
        >
          95% CI {ciSpan}
        </span>
      )}
    </div>
  );
}

/**
 * Precedent Match strip (#729 Step 2) — per-recipe percentile-rank
 * decomposition of the country-level QGI Risk Score.
 *
 * Per the 2026-05-16 per-recipe Majles:
 *  - Yuki: horizontal mini-bar-chart, 4 rows, single neutral palette
 *    (opacity-graded intensity), cohort_n visible glyph on every row
 *  - Roshani: cohort_n MUST be visible (not just hover); CI shown wider
 *    when small-cohort widening kicked in upstream
 *  - Ingrid: name is "Precedent Match" (NOT "Risk Score per recipe"),
 *    avoids the "probability of event" misread
 *  - Marcus: null rows shown EXPLICITLY (hatched bar + "—"), never hidden
 *  - Kwame: calibration metrics surfaced in tooltip (recipe ECE / LOCO AUC
 *    / advisory flag) so buyers know underlying reliability
 *  - STRICT ORDINAL: tooltip says "percentile rank, NOT a probability"
 */
function PrecedentMatchStrip({
  perRecipe,
}: {
  perRecipe: Record<string, QgiPerRecipeEntry | null>;
}) {
  // Stable ordering — top-4 LOCKed recipes in their canonical sequence so
  // the strip reads the same on every country (Yuki's grid-discipline rule).
  const orderedRecipes = [
    "civil_war_and_insurgency",
    "multilateral_agreement",
    "elections_and_voting",
    "bilateral_treaty",
  ];
  const recipesPresent = orderedRecipes.filter((r) => r in perRecipe);
  if (recipesPresent.length === 0) return null;

  return (
    <section aria-labelledby="precedent-match-heading" className="mb-6">
      <div className="mb-3 flex items-baseline justify-between flex-wrap gap-2">
        <h2
          id="precedent-match-heading"
          className="text-[11px] tracking-widest uppercase font-semibold"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Precedent Match ({recipesPresent.length} recipes)
        </h2>
        <span
          className="text-[10px]"
          style={{ color: "var(--qgi-text-dim)" }}
          title="Each bar is a percentile-rank score (0-100) of this country against the cohort of countries firing on that recipe. NOT a probability."
        >
          [Verified data] Per-recipe decomposition of the country score
        </span>
      </div>

      <div
        className="rounded-lg border overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <ul className="divide-y" style={{ borderColor: "var(--qgi-border)" }}>
          {recipesPresent.map((rid) => {
            const entry = perRecipe[rid];
            return (
              <li key={rid}>
                <PrecedentMatchRow recipeId={rid} entry={entry} />
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-[10px] mt-2" style={{ color: "var(--qgi-text-dim)" }}>
        Each row ranks this country against the cohort firing on that recipe. Higher =
        stronger pattern resemblance, not a probability of the event. Where a country has
        no top_category match for a recipe, the row is rendered as &ldquo;—&rdquo;.
      </p>
    </section>
  );
}

function PrecedentMatchRow({
  recipeId,
  entry,
}: {
  recipeId: string;
  entry: QgiPerRecipeEntry | null;
}) {
  const displayName = formatRecipeDisplayName(recipeId);
  if (entry === null) {
    return (
      <div
        className="px-4 py-2.5 grid items-center gap-3"
        style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 2fr) 90px" }}
        title={`No top_category match for ${displayName} in this country.`}
      >
        {/* #756 (persona-test 2026-05-17, Fatima/UNDP iPhone 14): truncating
            recipe names to ~12 characters ("Multilatera...", "Civil war &...")
            makes the table illegible on mobile. Allow 2-line wrap instead. */}
        <div
          className="text-sm font-medium break-words leading-tight"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          {displayName}
        </div>
        <div
          className="h-2 rounded"
          style={{
            background:
              "repeating-linear-gradient(45deg, var(--qgi-surface-2), var(--qgi-surface-2) 4px, transparent 4px, transparent 8px)",
            border: "1px solid var(--qgi-border)",
            opacity: 0.5,
          }}
          aria-label="No score for this recipe"
        />
        <div
          className="text-right font-data text-sm"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          —
        </div>
      </div>
    );
  }

  // Score bar: opacity-graded intensity. Score 0 → 20% opacity; 100 → 100%.
  const fillPct = Math.max(0, Math.min(100, entry.score));
  const opacity = 0.25 + 0.75 * (entry.score / 100);
  const ciSpan = `${entry.ci_low}–${entry.ci_high}`;
  const cohortN = entry.cohort_n_recipe;

  // Tooltip: strict-ordinal + calibration metrics if present (Kwame's veto).
  const tooltipParts: string[] = [];
  tooltipParts.push(
    `${displayName}: Precedent Match ${entry.score}/100. Percentile rank within the cohort of ${cohortN ?? "?"} countries firing on this recipe.`
  );
  tooltipParts.push("NOT a probability the event will occur.");
  if (entry.recipe_loco_auc !== null && entry.recipe_loco_auc !== undefined) {
    tooltipParts.push(`Recipe out-of-country AUC: ${entry.recipe_loco_auc.toFixed(3)}.`);
  }
  if (entry.recipe_ece !== null && entry.recipe_ece !== undefined) {
    tooltipParts.push(`Calibration error (ECE): ${entry.recipe_ece.toFixed(3)}.`);
  }
  if (entry.recipe_f_rule_advisory_flag) {
    tooltipParts.push("F-rule ADVISORY: treat as provisional.");
  }
  const tooltip = tooltipParts.join(" ");

  return (
    <div
      className="px-4 py-2.5 grid items-center gap-3"
      style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 2fr) 90px" }}
      title={tooltip}
    >
      <div className="min-w-0">
        {/* #756 (persona-test 2026-05-17, Fatima/UNDP iPhone 14): allow
            the recipe name to wrap to multiple lines on mobile instead
            of truncating. The constrained `minmax(0, 1.4fr)` column at
            390px viewport produced "Multilatera..." which is illegible. */}
        <div
          className="text-sm font-medium break-words leading-tight"
          style={{ color: "var(--qgi-text)" }}
        >
          {displayName}
          {entry.recipe_f_rule_advisory_flag && (
            <span
              className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase font-data"
              style={{
                color: "#fbbf24",
                backgroundColor: "rgba(251,191,36,0.10)",
                border: "1px solid rgba(251,191,36,0.35)",
              }}
              title="F-rule ADVISORY — treat this recipe's score as provisional."
            >
              Advisory
            </span>
          )}
        </div>
        {cohortN !== undefined && (
          <div
            className="text-[10px] font-data tabular-nums mt-0.5"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            N={cohortN}
          </div>
        )}
      </div>
      <div
        className="relative h-2 rounded"
        style={{ backgroundColor: "var(--qgi-surface-2)" }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded"
          style={{
            width: `${fillPct}%`,
            backgroundColor: "var(--qgi-text)",
            opacity,
          }}
          aria-label={`Precedent Match score: ${entry.score} of 100`}
        />
      </div>
      <div className="text-right">
        <div
          className="font-data tabular-nums text-sm font-semibold"
          style={{ color: "var(--qgi-text)" }}
        >
          {entry.score}
        </div>
        <div
          className="text-[9px] font-data tabular-nums mt-0.5"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          [{ciSpan}]
        </div>
      </div>
    </div>
  );
}

/**
 * "What's happening here" opening narrative (Ingrid voice).
 *
 * Brief: 90-110 words / 4-5 sentences / 3 movements:
 *   (1) shape of risk this country currently sits in
 *   (2) what shifted recently / temporal context
 *   (3) what the model keys on that a headline reader would miss
 *
 * PR #3 ships the preview-template variant (for unauthored countries).
 * Authored copy for hero countries (Iran, Syria, Venezuela, Germany,
 * Georgia + extensions) lands when qgi-data ships the per-country
 * authored-narrative JSON (follow-up).
 */
function WhatsHappeningHere({
  name,
  tier,
  top3,
  bakeDate,
}: {
  name: string;
  tier: RiskTier;
  top3: ReadonlyArray<{ category: string; salience_score: number }>;
  /** ISO-8601 date (YYYY-MM-DD) of the country-risks bake that produced
   *  this narrative's underlying salience scores. */
  bakeDate?: string;
}) {
  const top1 = top3[0] ? formatCategory(top3[0].category) : "—";
  // #757 (persona-test 2026-05-17): 3 personas (Marcus / James / Fatima)
  // independently read the prior "Preview template" amber chip as "this
  // page is unfinished — don't cite it." The narrative IS auto-generated
  // (deterministic template against signals data, not editorial copy);
  // the chip should disclose that *without* reading as a not-yet-shipped
  // status. Neutral status chip + visible bake date conveys data vintage
  // and authorship class in one breath.
  const statusLabel = bakeDate ? `Auto-generated · Bake ${bakeDate}` : "Auto-generated";
  return (
    <section className="mb-8" aria-labelledby="whats-happening-heading">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h2
          id="whats-happening-heading"
          className="text-[10px] tracking-widest uppercase"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          What&apos;s happening here
        </h2>
        <span
          className="font-data text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded"
          style={{
            color: "var(--qgi-text-muted)",
            backgroundColor: "var(--qgi-surface-2)",
            border: "1px solid var(--qgi-border)",
          }}
          title="This summary is deterministically generated from the country's signals data, not editorially authored. Per-country authored copy lands when qgi-data ships per-country authored-narrative JSON."
        >
          {statusLabel}
        </span>
      </div>
      <p
        className="text-base leading-relaxed max-w-[68ch]"
        style={{ color: "var(--qgi-text)" }}
      >
        {name} sits at Tier {tier} — {tierBlurb(tier)}. The current top-salience signal is{" "}
        {top1}; alongside it,{" "}
        {top3.length > 1
          ? formatCategory(top3[1].category).toLowerCase()
          : "other dimensions"}{" "}
        {top3.length > 2 ? `and ${formatCategory(top3[2].category).toLowerCase()} ` : ""}
        also register above background. The 8-row profile below shows the full L1-domain
        footprint; click through to{" "}
        <Link
          href={"/methodology" as Route}
          className="underline underline-offset-2"
          style={{ color: "var(--qgi-text)" }}
        >
          methodology
        </Link>{" "}
        for how composites and salience are computed.
      </p>
    </section>
  );
}

/**
 * PR #4 — Section 4 ML recipe coverage matrix (Marcus flagship). Brief
 * §"Section 4": 7-col table × 13 LOCKed recipes. Currently top-4 set
 * (the only recipes with stable buyer-view metrics); expands to full 13
 * post-KI-2 roster lock.
 *
 * Columns: Recipe · Architecture · LOCO AUC · Calibration · AHI · Pctile · Status
 *
 * Expansion default per brief 7th-vote: expanded when ≥1 anchor measured
 * in the top-4 set (proxy for ≥3/13 on the full LOCKed set). Uses native
 * <details> so server-render works (no client state).
 */
function MlCoverageMatrix({
  rows,
  covCount,
  defaultExpanded,
}: {
  rows: ReadonlyArray<MlMatrixRow>;
  covCount: number;
  defaultExpanded: boolean;
}) {
  return (
    <section className="mb-8" aria-labelledby="ml-matrix-heading">
      <details
        className="group rounded-lg border"
        open={defaultExpanded}
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <summary
          className="cursor-pointer px-4 py-3 flex items-center gap-2 flex-wrap"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          <span
            id="ml-matrix-heading"
            className="text-[10px] tracking-widest uppercase font-semibold"
          >
            ML recipe coverage
          </span>
          <span
            className="text-[9px] font-data normal-case tracking-normal"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            ({covCount} of {rows.length} validated recipes measured)
          </span>
          <span
            className="font-data text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded ml-2"
            style={{
              color: "rgba(251, 191, 36, 0.95)",
              backgroundColor: "rgba(251, 191, 36, 0.12)",
              border: "1px solid rgba(251, 191, 36, 0.30)",
            }}
            title="Anchor stability + Global percentile are preview values until the sibling bake ships per-country anchor data. Discrimination + Calibration are REAL."
          >
            Preview
          </span>
          <span
            className="ml-auto text-[10px] tracking-wider transition-transform group-open:rotate-90"
            aria-hidden="true"
          >
            ▶
          </span>
        </summary>
        <div className="border-t" style={{ borderColor: "var(--qgi-border)" }}>
          <div
            className="hidden md:grid items-center px-4 py-2 text-[10px] tracking-widest uppercase"
            style={{
              gridTemplateColumns: "2fr 110px 70px 70px 70px 60px 90px",
              gap: 8,
              color: "var(--qgi-text-dim)",
              backgroundColor: "var(--qgi-surface-2)",
              borderBottom: "1px solid var(--qgi-border)",
            }}
          >
            <span>Recipe</span>
            <span>Architecture</span>
            <span
              className="text-right"
              title="Discrimination (out-of-country): probability the recipe ranks a positive case above a negative one on countries never seen during training. 0.5 = chance, 1.0 = perfect."
            >
              Discrim.
            </span>
            <span
              className="text-right"
              title="Calibration error: average gap between predicted probability and observed frequency. 0 = perfectly calibrated; <0.02 target; >0.05 unreliable."
            >
              Calibration
            </span>
            <span
              className="text-right"
              title="Anchor stability for this country (preview value): how robust the recipe is to held-out anchor events. Higher = more stable."
            >
              Anchor
            </span>
            <span
              className="text-right"
              title="Global percentile rank for this recipe's anchor stability on this country (preview value)."
            >
              Pctile
            </span>
            <span>Status</span>
          </div>
          {rows.map((r, idx) => (
            <div
              key={r.recipe_id}
              className="grid items-center px-4 py-2.5 gap-2"
              style={{
                gridTemplateColumns: "2fr 110px 70px 70px 70px 60px 90px",
                borderBottom:
                  idx === rows.length - 1 ? "none" : "1px solid var(--qgi-border)",
              }}
              title={
                r.has_anchor
                  ? "Measured anchor for this country (preview value)"
                  : "No anchor case in v2 regression suite for this recipe yet"
              }
            >
              <span className="text-sm truncate" style={{ color: "var(--qgi-text)" }}>
                {r.display_name}
              </span>
              <span
                className="font-data text-[10px]"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {r.architecture_label}
              </span>
              <span
                className="font-data text-[11px] tabular-nums text-right"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                {r.loco_auc.toFixed(3)}
              </span>
              <span
                className="font-data text-[11px] tabular-nums text-right"
                style={{
                  color:
                    r.ece_overall <= 0.02
                      ? "#34d399"
                      : r.ece_overall <= 0.05
                        ? "var(--qgi-text-muted)"
                        : "#fbbf24",
                }}
              >
                {r.ece_overall.toFixed(3)}
              </span>
              <span
                className="font-data text-[11px] tabular-nums text-right"
                style={{
                  color:
                    r.ahi_preview !== null
                      ? "var(--qgi-text-muted)"
                      : "var(--qgi-text-dim)",
                }}
              >
                {r.ahi_preview !== null ? r.ahi_preview.toFixed(2) : "—"}
              </span>
              <span
                className="font-data text-[10px] tabular-nums text-right"
                style={{ color: "var(--qgi-text-dim)" }}
              >
                {r.pct_preview !== null ? `${r.pct_preview}p` : "—"}
              </span>
              <span>
                <StatusChip measured={r.has_anchor} />
              </span>
            </div>
          ))}
          <div
            className="px-4 py-2 text-[10px]"
            style={{
              color: "var(--qgi-text-dim)",
              backgroundColor: "var(--qgi-surface-2)",
              borderTop: "1px solid var(--qgi-border)",
            }}
          >
            Discrimination (out-of-country) + Calibration error from ml-recipe-stack
            (real). Per-country Anchor stability + Global percentile: preview values until
            anchor battery v3 ships (qgi-ml follow-up).{" "}
            <Link
              href={"/methodology" as Route}
              className="underline underline-offset-2"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              How to read this →
            </Link>
          </div>
        </div>
      </details>
    </section>
  );
}

function StatusChip({ measured }: { measured: boolean }) {
  if (measured) {
    return (
      <span
        className="font-data text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded"
        style={{
          color: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.10)",
          border: "1px solid rgba(34, 197, 94, 0.30)",
        }}
      >
        measured
      </span>
    );
  }
  return (
    <span
      className="font-data text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded"
      style={{
        color: "var(--qgi-text-dim)",
        border: "1px solid var(--qgi-border)",
      }}
      title="No anchor case in v2 regression suite for this recipe yet"
    >
      no anchor
    </span>
  );
}

/**
 * PR #4 — Section 5 Structural peers. Brief title: "Countries that look most
 * like {country} today" (Ingrid rename from "Structural Twins"). Top-5 by
 * cosine similarity on the 8-dim L1 salience vector. REAL data — no
 * Preview chip.
 */
function StructuralPeers({
  peers,
  subjectName,
}: {
  peers: ReadonlyArray<StructuralPeer>;
  subjectName: string;
}) {
  return (
    <section className="mb-8" aria-labelledby="peers-heading">
      <h2
        id="peers-heading"
        className="text-[10px] tracking-widest uppercase mb-3"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        Countries that look most like {subjectName} today
        <span
          className="ml-2 text-[9px] font-data normal-case tracking-normal"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          (top 5 by L1 risk-profile similarity)
        </span>
      </h2>
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        {peers.map((peer, idx) => {
          const peerTierMeta = TIER_META[peer.tier as RiskTier];
          const simPct = Math.round(peer.similarity * 100);
          return (
            <Link
              key={peer.slug}
              href={`/countries/${peer.slug}` as Route}
              className="grid items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--qgi-surface-2)] group"
              style={{
                gridTemplateColumns: "32px 1fr 110px 1fr 64px",
                borderBottom:
                  idx === peers.length - 1 ? "none" : "1px solid var(--qgi-border)",
                borderLeft: `3px solid ${peerTierMeta?.color ?? "var(--qgi-border)"}`,
              }}
            >
              <CountryFlag alpha2={peer.alpha_2} size={14} />
              <span
                className="text-sm group-hover:text-[var(--qgi-accent)] transition-colors font-medium"
                style={{ color: "var(--qgi-text)" }}
              >
                {peer.name}
              </span>
              {peerTierMeta && <TierPill meta={peerTierMeta} />}
              <div
                className="rounded-sm overflow-hidden"
                style={{
                  backgroundColor: "var(--qgi-border)",
                  height: 4,
                }}
                role="img"
                aria-label={`Similarity: ${simPct}%`}
                title="Cosine similarity on 8-dim L1 risk-profile vectors. Higher = more similar risk fingerprint."
              >
                <div
                  style={{
                    width: `${simPct}%`,
                    height: "100%",
                    backgroundColor: "#38bdf8",
                    borderRadius: 2,
                  }}
                />
              </div>
              <span
                className="font-data text-[11px] tabular-nums text-right"
                style={{ color: "var(--qgi-text-muted)" }}
              >
                {simPct}%
              </span>
            </Link>
          );
        })}
      </div>
      <p className="text-[10px] mt-2" style={{ color: "var(--qgi-text-dim)" }}>
        Similarity computed on the 8-dim L1 risk-profile vector (max-salience per L1
        group, cosine similarity). REAL data.
      </p>
    </section>
  );
}

function tierBlurb(tier: RiskTier): string {
  switch (tier) {
    case "HIGH":
      return "the top 20% of countries we score";
    case "MODERATE":
      return "the middle band, with at least one elevated risk dimension";
    case "INDICATIVE":
      return "background level, with no dimension currently elevated above MODERATE";
    default:
      // PR #3 Sonnet review nit: explicit default so a future RiskTier
      // addition doesn't silently emit "undefined." in the prose template.
      return "";
  }
}

/**
 * Country-specific "What this doesn't mean" 3-bullet callout (Ingrid voice,
 * brief verbatim with {country}/{year} substitutions). Per Marcus + Sipho
 * carry-over from list page: keep on every detail page.
 */
function WhatThisDoesntMean({ name }: { name: string }) {
  // PR #3 Sonnet review nit: use getUTCFullYear so build-machine local
  // time doesn't leak into the rendered year token. ISR rebuilds hourly
  // catch the year rollover by Jan 1 UTC.
  const year = new Date().getUTCFullYear();
  return (
    <section
      role="note"
      aria-label="What tier does not mean"
      className="mb-8 rounded-lg p-4 max-w-[68ch]"
      style={{
        backgroundColor: "rgba(251, 191, 36, 0.08)",
        border: "1px solid rgba(251, 191, 36, 0.30)",
      }}
    >
      <div
        className="text-[10px] tracking-widest uppercase font-semibold mb-2"
        style={{ color: "rgba(251, 191, 36, 0.95)" }}
      >
        What this doesn&apos;t mean
      </div>
      <ul
        className="text-xs leading-relaxed list-disc pl-5 space-y-1"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        <li>
          This is not a forecast that {name} will collapse or face a specific outcome in{" "}
          {year}.
        </li>
        <li>It is not a comment on the legitimacy of any government.</li>
        <li>
          It is a structural-pattern reading; outcomes depend on choices not yet made.
        </li>
      </ul>
    </section>
  );
}

/**
 * One row of the L1 risk profile small-multiples table (Section 3). Real
 * salience drives the bar width (normalized against the country's max
 * L1 salience). Top-3-driver rows get a caret marker + bold treatment.
 *
 * Brief Section 3 full spec includes additional columns (world median tick
 * / 75yr sparkline / rank / trend Δ) — deferred to PR #4 once the
 * per-L1 world-median dataset bakes.
 */
function L1Row({
  row,
  maxSalience,
  isTopDriver,
  isLast,
}: {
  row: {
    code: string;
    label: string;
    shortLabel: string;
    color: string;
    salience: number | null;
  };
  maxSalience: number;
  isTopDriver: boolean;
  isLast: boolean;
}) {
  const sal = row.salience ?? 0;
  const pct = Math.min(100, Math.max(0, (sal / maxSalience) * 100));
  return (
    <div
      className="grid items-center gap-3 px-4 py-3"
      style={{
        gridTemplateColumns: "32px 1fr 1.4fr 64px",
        borderBottom: isLast ? "none" : "1px solid var(--qgi-border)",
        borderLeft: `3px solid ${row.color}`,
        backgroundColor: isTopDriver ? "rgba(56, 189, 248, 0.04)" : "transparent",
      }}
    >
      {/* L1 code chip (A..H) */}
      <span
        className="font-data text-[10px] font-semibold tracking-widest uppercase text-center px-1 py-0.5 rounded"
        style={{
          color: row.color,
          backgroundColor: `${row.color}18`,
          border: `1px solid ${row.color}40`,
        }}
        title={row.label}
      >
        {row.code}
      </span>

      {/* Full L1 label + top-driver marker */}
      <span
        className="text-sm flex items-center gap-1.5"
        style={{
          color: "var(--qgi-text)",
          fontWeight: isTopDriver ? 600 : 400,
        }}
      >
        {row.label}
        {isTopDriver && (
          <span
            className="font-data text-[9px] tracking-widest uppercase ml-1"
            style={{ color: "var(--qgi-accent)" }}
            title="Top-3 driver — one of this country's strongest current signals"
          >
            ▸ driver
          </span>
        )}
      </span>

      {/* Salience bar (REAL data, normalized) */}
      <div
        className="rounded-sm overflow-hidden"
        style={{
          backgroundColor: "var(--qgi-border)",
          height: 6,
        }}
        role="img"
        aria-label={`${row.shortLabel} salience: ${sal.toFixed(2)} of ${maxSalience.toFixed(2)} max`}
        title={`Max salience score across all tier windows for the ${row.label} L1 group. Bar normalized against the country's strongest L1 signal.`}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            backgroundColor: row.color,
            borderRadius: 2,
          }}
        />
      </div>

      {/* Numeric salience (tabular) */}
      <span
        className="font-data text-[11px] tabular-nums text-right"
        style={{
          color: sal > 0 ? "var(--qgi-text-muted)" : "var(--qgi-text-dim)",
        }}
      >
        {sal > 0 ? sal.toFixed(2) : "—"}
      </span>
    </div>
  );
}
