import { loadRecipeBySlug } from "@/lib/recipes-aggregated-loader";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { loadCountryRisks } from "@/lib/country-risks";
import { buildSlugMap, toBuyerView } from "@/lib/buyer-view";
import { PrecedentMergedDossier } from "@/components/precedents/PrecedentMergedDossier";
import {
  PrecedentMatchLeaderboard,
  type LeaderboardEntry,
} from "@/components/precedents/PrecedentMatchLeaderboard";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * /precedents/[slug] — Merged dossier detail page.
 *
 * #748 PR-2 (#750), 2026-05-17. Per the ratified Majles brief at
 * `qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-17-precedents-revised.md`
 * §3 — single merged-dossier template for all four LOCKed ML recipes.
 * Single scroll, no tabs, no toggle, no template-switching. Fuses the
 * V2 detail's adjudication block (Tier + OOC AUC + calibration + anchor)
 * with the V1 detail's statistical substrate (PPS + instances + OECD +
 * indicator fingerprint).
 *
 * Routing:
 *   - Slug in top_4_recipes (LOCKed ML) → render PrecedentMergedDossier
 *   - Anything else → notFound() for now; PR-3 (#751) adds 301 redirects
 *     from the ~64 retired stat-only slugs to /precedents.
 *
 * Supersedes the 2026-05-13 split-render that mismatched the founder's
 * L10525 directive.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const stack = await loadMlRecipeStack().catch(() => null);
  const raw = stack?.recipes.find((r) => r.recipe_id === slug) ?? null;
  if (raw && stack && stack.metadata.top_4_recipes.includes(raw.recipe_id)) {
    const buyer = toBuyerView(raw);
    return {
      title: `${buyer.display_name} · QG Intelligence`,
      description: `${buyer.display_name}: ${buyer.tier} tier (ML-adjudicated), out-of-country score ${buyer.loco_auc.toFixed(
        3
      )} (${buyer.n_pos_loco} held-out positive${
        buyer.n_pos_loco === 1 ? "" : "s"
      }). Merged dossier with the statistical substrate it was promoted from.`,
      alternates: { canonical: `/precedents/${slug}` },
    };
  }
  // Non-LOCKed slug — PR-3 will turn this into a 301 redirect, but we
  // still need a metadata return value for the notFound() fallback.
  return {
    title: "Page not found · QG Intelligence",
    robots: { index: false, follow: false },
  };
}

// ---------------------------------------------------------------------------
// generateStaticParams — only the 4 LOCKed slugs render now (per the
// founder directive "all other recipes/precedents must be removed from
// view"). The non-LOCKed slugs are handled by the PR-3 redirect map; until
// then they fall through to notFound() at request time.
// ---------------------------------------------------------------------------

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const stack = await loadMlRecipeStack().catch(() => null);
  const mlSlugs = stack?.metadata.top_4_recipes ?? [];
  return mlSlugs.map((slug) => ({ slug }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PrecedentDetailPage({ params }: Props) {
  const { slug } = await params;

  // Load the ML stack and confirm this slug is in the LOCKed set.
  const stack = await loadMlRecipeStack().catch(() => null);
  const mlRaw = stack?.recipes.find((r) => r.recipe_id === slug) ?? null;
  const isLocked =
    !!mlRaw && !!stack && stack.metadata.top_4_recipes.includes(mlRaw.recipe_id);

  // Non-LOCKed slug — bail. PR-3 (#751) will replace this with a 301
  // redirect from the ~64 retired stat-only slugs to /precedents. Until
  // PR-3 ships, the catalogue links are dead (and that's intentional:
  // the founder's L10525 directive removed them from view).
  if (!isLocked || !mlRaw || !stack) {
    notFound();
  }

  // Buyer-view transform of the ML recipe (jargon-cleaned, indicators
  // friendly, architecture relabeled).
  const slugMap = buildSlugMap(stack.recipes);
  const buyer = toBuyerView(mlRaw, slugMap);

  // Statistical substrate — RecipeAggregated row for the same
  // event_category. This is the merge that the previous brief lost:
  // ML adjudication + Stats substrate inside one dossier, not two
  // separate pages. Every LOCKed recipe MUST have a substrate row
  // (LOCK promotion is gated on stat data); if it's missing, the bake
  // is broken — surface as 404 so it's visible.
  const substrate = await loadRecipeBySlug(slug).catch(() => null);
  if (!substrate) notFound();

  // Paper-anchor href for the methodology cross-ref footer link.
  const paperHref = `https://github.com/AminAlAit/qgi-docs/blob/main/methodology/stage-5-buyer-disclosure-methodology-paper.md#${buyer.paper_section_anchor}`;

  // Cross-family leaderboard — top countries currently scoring on this
  // recipe (Spec §3.1 section 8). Reciprocal of the per-recipe strip
  // on /countries/[iso]. Hidden when fewer than MIN_LEADERBOARD_COUNT
  // countries score on this recipe.
  const risksData = await loadCountryRisks().catch(() => null);
  const leaderboardEntries: LeaderboardEntry[] = [];
  let leaderboardCohortN: number | undefined;
  if (risksData) {
    leaderboardCohortN = risksData.qgi_risk_score_per_recipe_cohort_n?.[slug];
    for (const [cid, c] of Object.entries(risksData.countries)) {
      const entry = c.qgi_risk_score_by_recipe?.[slug];
      if (!entry) continue;
      leaderboardEntries.push({
        countryId: cid,
        countryName: c.name,
        alpha_2: c.alpha_2,
        score: entry.score,
        ci_low: entry.ci_low,
        ci_high: entry.ci_high,
      });
    }
    leaderboardEntries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.ci_low - a.ci_low;
    });
  }

  return (
    <PrecedentMergedDossier
      recipe={buyer}
      substrate={substrate}
      generatedAt={stack.metadata.generated_at}
      paperHref={paperHref}
      leaderboardSlot={
        <PrecedentMatchLeaderboard
          recipeId={slug}
          recipeDisplayName={buyer.display_name}
          entries={leaderboardEntries}
          cohortN={leaderboardCohortN}
        />
      }
    />
  );
}
