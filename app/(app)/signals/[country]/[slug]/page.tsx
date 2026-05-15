import { loadCountryRisks, resolveCountryBySlug } from "@/lib/country-risks";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { toBuyerView } from "@/lib/buyer-view";
import { countrySlug } from "@/lib/slug";
import { CATEGORY_L1_MAP, L1_GROUPS, type L1Group } from "@/lib/category-taxonomy";
import { SignalsLeafDetail } from "@/components/signals/SignalsLeafDetail";
import type { BuyerMlRecipe } from "@/lib/buyer-view";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * /signals/[country]/[slug] — Per-(country, recipe) leaf for Family 3.
 *
 * Build PR #4 of 5 (founder-gated cutover at PR #5):
 *   - PR #1: route scaffold + filter strip + 71-row table
 *   - PR #2: 5 firing now band + 8-domain activation strip
 *   - PR #3: per-country watchlist /signals/[country]
 *   - PR #4 (this): per-(country, recipe) leaf with split-render by
 *     lineage — STAT panel (V1 max-salience-z provenance) vs ML panel
 *     (LOCO AUC + calibration + anchor stability) depending on whether
 *     the recipe slug resolves against the LOCKed ML stack
 *   - PR #5 (founder-gated): cutover
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 3 — Signals / leaf composition lines ~770-900)
 *
 * Scope of PR #4 (Tufte-minimal — full 11-section spec deferred to follow-up):
 *   - Hero with country flag + h1 "{Country} — {Category}" + tier badge
 *   - Lineage chip (STAT or ML) + lineage-conditional stats panel
 *   - Section 1 "What's happening here" preview-template (Ingrid 90-110w
 *     hand-authored prose deferred to #683)
 *   - Top-K indicators table (when ML lineage available)
 *   - Cross-family handoffs footer (precedents / country signals /
 *     country profile)
 *
 * Deferred to follow-up PRs: fused fingerprint+trajectory grid, critical
 * disclosure callouts, historical analogues table, coverage bias diagnostic,
 * recipe-switcher, methodology cross-ref.
 *
 * generateStaticParams pre-renders only (country, recipe) pairs that are
 * actually firing (a category appears in country.tiers.*.top_categories).
 * Non-firing pairs fall through to notFound() — keeps build time bounded
 * (~2-3K pages vs 11K full Cartesian).
 */

interface Props {
  params: Promise<{ country: string; slug: string }>;
}

export type SignalTier = "HIGH" | "MODERATE" | "INDICATIVE";

function tierForSalience(maxSalience: number): SignalTier {
  if (maxSalience >= 2.5) return "HIGH";
  if (maxSalience >= 1.0) return "MODERATE";
  return "INDICATIVE";
}

function displayNameFor(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, slug } = await params;
  const c = await resolveCountryBySlug(country).catch(() => null);
  if (!c) {
    return {
      title: "Signal not found — QGI Intelligence",
    };
  }
  const display = displayNameFor(slug);
  return {
    title: `${c.name} — ${display} — Signals — Merged Preview — QGI Intelligence`,
    description: `Per-country, per-recipe signal leaf for ${c.name} on ${display}. Preview shell — Family 3 build phase.`,
  };
}

export const revalidate = 3600;

export async function generateStaticParams() {
  const data = await loadCountryRisks().catch(() => null);
  if (!data) return [];
  const out: { country: string; slug: string }[] = [];
  for (const country of Object.values(data.countries)) {
    const cslug = countrySlug(country.name);
    if (!cslug) continue;
    const seen = new Set<string>();
    for (const tierBlock of Object.values(country.tiers ?? {})) {
      for (const cat of tierBlock.top_categories ?? []) {
        if (seen.has(cat.category)) continue;
        seen.add(cat.category);
        out.push({ country: cslug, slug: cat.category });
      }
    }
  }
  return out;
}

export interface LeafStatPanel {
  /** Max salience-z across all tier windows for this country/category. */
  max_salience: number;
  /** Per-tier window breakdown ({S,M,L,XL} → salience-z, where present). */
  by_window: Array<{ window: string; salience: number }>;
}

export interface LeafMlPanel {
  recipe: BuyerMlRecipe;
  is_top_4: boolean;
}

export default async function SignalsLeafPage({ params }: Props) {
  const { country, slug } = await params;
  const c = await resolveCountryBySlug(country).catch(() => null);
  if (!c) notFound();

  // Gather statistical lineage — pull every (tier_window) entry for this
  // category. If nothing fires, return notFound() (page is for active leaves).
  const byWindow: Array<{ window: string; salience: number }> = [];
  let maxSalience = -Infinity;
  for (const [windowKey, tierBlock] of Object.entries(c.tiers ?? {})) {
    for (const cat of tierBlock.top_categories ?? []) {
      if (cat.category !== slug) continue;
      const sal = cat.salience_score ?? cat.z_score ?? 0;
      byWindow.push({ window: windowKey, salience: sal });
      if (sal > maxSalience) maxSalience = sal;
    }
  }
  // If we want to also surface a leaf for non-firing recipes (preview shell),
  // we'd keep going here. For PR #4, an empty statistical hit means there's
  // no leaf to show — fall through to notFound.
  if (byWindow.length === 0) notFound();
  byWindow.sort((a, b) => b.salience - a.salience);
  const statPanel: LeafStatPanel = {
    max_salience: maxSalience,
    by_window: byWindow,
  };

  // ML lineage attempt — does this recipe slug resolve against the LOCKed
  // ML stack? If yes, surface the ML panel alongside. Top-4 set is the
  // current "flagship" subset surfaced on the Countries detail ML matrix.
  let mlPanel: LeafMlPanel | null = null;
  const mlStack = await loadMlRecipeStack().catch(() => null);
  if (mlStack) {
    const entry = mlStack.recipes.find((r) => r.recipe_id === slug);
    if (entry) {
      mlPanel = {
        recipe: toBuyerView(entry),
        is_top_4: mlStack.metadata.top_4_recipes.includes(entry.recipe_id),
      };
    }
  }

  // L1 group metadata for the hero chip.
  const mapping = CATEGORY_L1_MAP[slug];
  const l1: L1Group | null = mapping
    ? (L1_GROUPS.find((g) => g.code === mapping.group) ?? null)
    : null;

  const display = displayNameFor(slug);
  const tier = tierForSalience(maxSalience);
  const generatedDate = new Date().toISOString().slice(0, 10);

  return (
    <SignalsLeafDetail
      countrySlug={country}
      countryName={c.name}
      alpha2={c.alpha_2}
      categorySlug={slug}
      displayName={display}
      tier={tier}
      l1={l1}
      statPanel={statPanel}
      mlPanel={mlPanel}
      generatedDate={generatedDate}
      curated={c.curated}
    />
  );
}
