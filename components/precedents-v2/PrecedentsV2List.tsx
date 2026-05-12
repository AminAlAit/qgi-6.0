"use client";

import Link from "next/link";
import { InterpretationHintBadge, type CalloutStyle } from "@/components/ml/Callouts";
import type { MlRecipeEntry } from "@/lib/recipes-ml";
import { rewriteRecipeSlugsInProse } from "@/lib/recipe-narrative";

/**
 * V2 precedents list — top-4 LOCKed ML recipes per Majles 2026-05-11 Topic 5.
 *
 * Style variant is passed in as `caveatStyle`:
 * - `tufte` → `/precedents-v2-a` (footnote-style caveats)
 * - `lloyds` → `/precedents-v2-b` (full-width banner caveats)
 *
 * Both variants render the same recipe rows and the same Asas-derived
 * interpretation_hint badges; they differ only in chrome.
 */

const TIER_RANK: Record<MlRecipeEntry["tier"], number> = {
  STRONG: 0,
  MODERATE: 1,
  MARGINAL: 2,
};

const TIER_COLORS: Record<MlRecipeEntry["tier"], string> = {
  STRONG: "#22c55e", // green-500
  MODERATE: "#fbbf24", // amber-400
  MARGINAL: "#a3a3a3", // neutral-400
};

export function PrecedentsV2List({
  recipes,
  caveatStyle,
  generatedAt,
  modelVersion,
  totalLocked,
}: {
  recipes: MlRecipeEntry[];
  caveatStyle: CalloutStyle;
  generatedAt: string;
  modelVersion: string;
  /** Total LOCKed recipes in the dispatch (currently 13 post-KI-2). The
   *  list page shows N of M; pass from the page handler so the copy stays
   *  honest when future Majles amendments change the LOCKed count. */
  totalLocked: number;
}) {
  // Tier-ordered then alphabetical for deterministic layout
  const sorted = [...recipes].sort((a, b) => {
    const tierDiff = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (tierDiff !== 0) return tierDiff;
    return a.recipe_id.localeCompare(b.recipe_id);
  });
  const variantLetter = caveatStyle === "tufte" ? "a" : "b";
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1
          className="text-xs tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Precedents V2 ({variantLetter.toUpperCase()})
        </h1>
        <p className="text-2xl font-semibold mb-2" style={{ color: "var(--qgi-text)" }}>
          ML-derived precedent recipes
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text-dim)" }}>
          Top-4 validated recipes from the hybrid prediction architecture (
          {recipes.length} of {totalLocked} validated). Each card carries the
          buyer-disclosure metrics the Lloyd&apos;s actuarial framework requires:
          out-of-country discrimination, in-sample calibration, training-concentration
          disclosure, and an Asas mini-Majles interpretation hint.{" "}
          {caveatStyle === "tufte" ? (
            <span className="italic">
              This is the Tufte-style variant — caveats render as footnote annotations.{" "}
              <Link
                href="/precedents-v2-b"
                className="underline"
                style={{ color: "var(--qgi-text)" }}
              >
                Lloyd&apos;s-style banner variant →
              </Link>
            </span>
          ) : (
            <span className="italic">
              This is the Lloyd&apos;s-style variant — caveats render as full-width
              banners.{" "}
              <Link
                href="/precedents-v2-a"
                className="underline"
                style={{ color: "var(--qgi-text)" }}
              >
                Tufte-style footnote variant →
              </Link>
            </span>
          )}
        </p>
      </header>

      <div className="space-y-3" data-testid="recipe-list">
        {sorted.map((r) => (
          <RecipeRow key={r.recipe_id} recipe={r} caveatStyle={caveatStyle} />
        ))}
      </div>

      <footer
        className="mt-12 pt-6 text-xs border-t"
        style={{
          color: "var(--qgi-text-dim)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <p>
          Generated {generatedAt} · Model version {modelVersion}. See{" "}
          <Link
            href="/precedents"
            className="underline"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            V1 precedents (statistical recipe system)
          </Link>{" "}
          for the legacy, country-coverage-broader view.
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recipe row card
// ---------------------------------------------------------------------------

function RecipeRow({
  recipe,
  caveatStyle,
}: {
  recipe: MlRecipeEntry;
  caveatStyle: CalloutStyle;
}) {
  // Next.js typed-routes wants statically-resolvable hrefs; build the
  // href via a ternary on caveatStyle so each branch is literal.
  const href =
    caveatStyle === "tufte"
      ? (`/precedents-v2-a/${recipe.recipe_id}` as const)
      : (`/precedents-v2-b/${recipe.recipe_id}` as const);
  const tierColor = TIER_COLORS[recipe.tier];
  return (
    <Link
      href={href}
      className="block rounded-lg p-5 transition-colors"
      style={{
        backgroundColor: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex items-center rounded font-data font-semibold tracking-wider px-1.5 py-0.5 text-[10px]"
              style={{
                color: tierColor,
                backgroundColor: `${tierColor}18`,
                border: `1px solid ${tierColor}40`,
              }}
            >
              {recipe.tier}
            </span>
            <span
              className="font-data text-[10px]"
              style={{ color: "var(--qgi-text-dim)" }}
            >
              {recipe.architecture} architecture
            </span>
            {recipe.advisory_only_flag && (
              <span
                className="font-data font-semibold text-[10px] uppercase tracking-wide"
                style={{ color: "#a16207" }}
                title="Composite-only signal — sole positive in held-out partition. Do not use as a primary signal for standalone pricing; only as one component of a composite score."
              >
                Composite-only
              </span>
            )}
            {recipe.f_rule_anomaly_flag && (
              <span className="font-data text-[10px]" style={{ color: "#a16207" }}>
                F-rule anomaly
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--qgi-text)" }}>
            {recipe.display_name}
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--qgi-text-dim)" }}>
            {rewriteRecipeSlugsInProse(recipe.mechanism_narrative_excerpt, {
              [recipe.recipe_id]: recipe.display_name,
            })}
          </p>
        </div>
        <div className="text-right">
          <div
            className="font-data text-xl font-semibold"
            style={{ color: "var(--qgi-text)" }}
          >
            {recipe.loco_auc.toFixed(3)}
          </div>
          <div
            className="font-data text-[10px] tracking-wide uppercase"
            style={{ color: "var(--qgi-text-dim)" }}
            title="Discrimination score on countries the model never saw during training (0.5 = chance, 1.0 = perfect)"
          >
            Out-of-country
          </div>
          <div
            className="font-data text-[10px] mt-1"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            {recipe.n_pos_loco} held-out positive
            {recipe.n_pos_loco === 1 ? "" : "s"}
          </div>
        </div>
      </div>
      <InterpretationHintBadge style={caveatStyle} hint={recipe.interpretation_hint} />
    </Link>
  );
}
