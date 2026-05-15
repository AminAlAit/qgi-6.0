import {
  loadRecipeBySlug,
  loadCountryRecipeScores,
} from "@/lib/recipes-aggregated-loader";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { loadCountryRisks } from "@/lib/country-risks";
import { buildSlugMap, toBuyerView } from "@/lib/buyer-view";
import { CATEGORY_L1_MAP } from "@/lib/category-taxonomy";
import { countrySlug } from "@/lib/slug";
import { PrecedentsV2Detail } from "@/components/precedents-v2/PrecedentsV2Detail";
// V1 component reused inside the canonical /precedents/[slug] page —
// originally lived at @/components/precedents/PrecedentSlugClient before
// PR-iii renamed V1 components to the -v1 suffix.
import { PrecedentSlugClient } from "@/components/precedents-v1/PrecedentSlugClient";
import { MergedDetailFooter } from "@/components/precedents/MergedDetailFooter";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * /precedents/[slug] — Detail page for the merged Precedents shell.
 *
 * Build PR #2 of 5 (A3 Family 1). Brief:
 *   qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *
 * Split-render by recipe lineage (brief section "Detail page composition"):
 *   - ML-validated lineage (top-4 in ml-recipe-stack.json) →
 *       Template A (PrecedentsV2Detail) — preserves Phase A2 layout
 *       (discrimination + calibration + anchor stability + indicators).
 *       Banner caveat style only — variant switch removed per brief.
 *   - Statistical-only lineage (the other 64 categories) →
 *       Template B (PrecedentSlugClient) — preserves V1 layout
 *       (canonical length + indicator fingerprint + coverage bias +
 *       currently-flagged countries).
 *
 * Both lineages get the MergedDetailFooter wrapper which adds:
 *   - Sibling lineage cross-link (ML ↔ Stat)
 *   - "See related ranked patterns →" → /patterns?sort=loco_auc
 *     (Family 4 brief locked target — was /patterns/ranking)
 *   - "How we validated this →" → /methodology
 *
 * Deferred to PR #3:
 *   - Click-to-expand 120w mechanism cell
 *   - "What we're still testing" <details> collapsible (list page)
 *   - "How to read this" preamble + lede (list page)
 *   - Country-name inline links inside mechanism cell
 *   - "{n} countries firing now →" pill inside mechanism cell
 */

interface Props {
  params: Promise<{ slug: string }>;
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Try ML lineage first. If the slug is in the top-4 LOCKed set, use the
  // ML metadata path (richer display_name + tier + LOCO).
  const stack = await loadMlRecipeStack().catch(() => null);
  const raw = stack?.recipes.find((r) => r.recipe_id === slug) ?? null;
  if (raw && stack && stack.metadata.top_4_recipes.includes(raw.recipe_id)) {
    const buyer = toBuyerView(raw);
    return {
      title: `${buyer.display_name} — QGI Intelligence`,
      description: `${buyer.display_name}: ${buyer.tier} tier (ML-adjudicated), out-of-country score ${buyer.loco_auc.toFixed(3)} (${buyer.n_pos_loco} held-out positive${buyer.n_pos_loco === 1 ? "" : "s"}).`,
      // No robots override — indexable at canonical URL post-cutover.
    };
  }
  // Fall back to Stat-catalogue path.
  if (!(slug in CATEGORY_L1_MAP)) {
    return {
      title: "Page not found — QGI Intelligence",
    };
  }
  const recipe = await loadRecipeBySlug(slug).catch(() => null);
  const label = formatCategory(slug);
  const description = recipe
    ? `Historical recipe for ${label}: ${recipe.total_instances} instances, canonical pattern length ${recipe.canonical_length} years. Statistical lineage — not yet ML-adjudicated.`
    : `Historical recipe for ${label}.`;
  return {
    title: `${label} — QGI Intelligence`,
    description,
  };
}

// ---------------------------------------------------------------------------
// generateStaticParams — pre-render top-4 ML slugs + every Stat catalogue
// slug at build time. Unknown slugs fall through to notFound() at runtime.
// ---------------------------------------------------------------------------

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const stack = await loadMlRecipeStack().catch(() => null);
  const mlSlugs = stack?.metadata.top_4_recipes ?? [];
  const statSlugs = Object.keys(CATEGORY_L1_MAP);
  // Union the two — overlap is fine (Next dedupes static params by slug).
  return Array.from(new Set([...mlSlugs, ...statSlugs])).map((slug) => ({ slug }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PrecedentsMergedSlugPage({ params }: Props) {
  const { slug } = await params;

  // ML lineage takes precedence: if the slug is in the top-4 LOCKed set,
  // render Template A. Otherwise fall to Template B (Stat catalogue).
  const stack = await loadMlRecipeStack().catch(() => null);
  const mlRaw = stack?.recipes.find((r) => r.recipe_id === slug) ?? null;
  const isMlHero =
    !!mlRaw && !!stack && stack.metadata.top_4_recipes.includes(mlRaw.recipe_id);

  if (isMlHero && mlRaw && stack) {
    // Template A — ML lineage detail (preserves Phase A2 layout).
    // Buyer-view transform: prose jargon-cleaned, indicators friendly,
    // architecture relabeled. Full slug map for cross-recipe references.
    const slugMap = buildSlugMap(stack.recipes);
    const buyer = toBuyerView(mlRaw, slugMap);
    const paperHref = `https://github.com/AminAlAit/qgi-docs/blob/main/methodology/stage-5-buyer-disclosure-methodology-paper.md#${buyer.paper_section_anchor}`;
    return (
      <>
        <PrecedentsV2Detail
          recipe={buyer}
          // Banner caveats per the brief decision: "Variant switch removed;
          // compact A killed; banner-only on detail."
          caveatStyle="lloyds"
          generatedAt={stack.metadata.generated_at}
          paperHref={paperHref}
        />
        <MergedDetailFooter lineage="ML" />
      </>
    );
  }

  // Template B — Stat catalogue detail (preserves V1 layout).
  // Validate against the canonical L3 taxonomy — guards against typos and
  // unknown slugs landing on a confusingly-empty page.
  if (!(slug in CATEGORY_L1_MAP)) notFound();
  const recipe = await loadRecipeBySlug(slug);
  if (!recipe) notFound();

  // Currently-flagged countries cross-reference (V1 baseline behavior).
  // Read country-recipe-scores + country-risks to build the per-country
  // similarity-score list that the V1 component renders.
  const scoresFile = await loadCountryRecipeScores().catch(() => null);
  const risksFile = await loadCountryRisks().catch(() => null);
  const slugToCountry = new Map<
    string,
    { id: string; name: string; alpha_2: string; tier: string }
  >();
  if (risksFile) {
    for (const [id, c] of Object.entries(risksFile.countries)) {
      const s = countrySlug(c.name);
      if (!s) continue;
      slugToCountry.set(s, {
        id,
        name: c.name,
        alpha_2: c.alpha_2,
        tier: c.overall_risk_tier,
      });
    }
  }
  const flaggedCountries: Array<{
    countrySlug: string;
    name: string;
    alpha_2: string;
    score: number;
    tier: string;
  }> = [];
  if (scoresFile) {
    for (const [cSlug, byRecipe] of Object.entries(scoresFile.scores)) {
      const score = byRecipe[slug];
      if (typeof score !== "number") continue;
      const meta = slugToCountry.get(cSlug);
      flaggedCountries.push({
        countrySlug: cSlug,
        name: meta?.name ?? formatCategory(cSlug),
        alpha_2: meta?.alpha_2 ?? "",
        score,
        tier: meta?.tier ?? "INDICATIVE",
      });
    }
    flaggedCountries.sort((a, b) => b.score - a.score);
  }

  return (
    <>
      <PrecedentSlugClient recipe={recipe} flaggedCountries={flaggedCountries} />
      <MergedDetailFooter lineage="STAT" />
    </>
  );
}
