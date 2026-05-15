import { loadCountryRisks, resolveCountryBySlug } from "@/lib/country-risks";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { toBuyerViewList } from "@/lib/buyer-view";
import { CATEGORY_L1_MAP, L1_GROUPS } from "@/lib/category-taxonomy";
import { countrySlug } from "@/lib/slug";
import { CountryMergedDetail } from "@/components/countries/CountryMergedDetail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

// PR #4 — deterministic seeded RNG (mirrors the list-page seedRng in
// CountriesMergedListClient). Used to fabricate per-country/per-recipe AHI
// + global-percentile values until #648 sibling bake ships per-country
// anchor stability scores.
function seededRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = Math.imul(16807, h) | 0;
    return (h >>> 0) / 0xffffffff;
  };
}

/**
 * /countries/[iso] — Detail page for the merged Countries shell.
 *
 * Build PR #3 of 5 (A3 Family 2). Brief:
 *   qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 2 — Countries §"Detail page composition")
 *
 * Scope of PR #3:
 *   - Hero (flag + name + tier pill + top-line)
 *   - Lloyd's tier banner
 *   - Section 1 "What's happening here" (Ingrid template; preview-template
 *     fallback for ~140 unauthored countries)
 *   - Section 2 "What this doesn't mean" 3-bullet callout (country-specific)
 *   - Section 3 — L1 risk profile (8-row small-multiples; Elif fold of
 *     V1 8 cards + V2-narrative 3-categories-driving)
 *   - Cross-family handoffs footer (Precedents + Signals + Patterns)
 *
 * Deferred to PR #4:
 *   - ML recipe coverage matrix (13 LOCKed × 6 cols, Marcus flagship)
 *   - Structural peers section
 *   - Indicator trajectories small-multiples grid
 *   - Recent events density-strip + 12-month default + year drawer
 *   - Top Precedents (S-win/M-win/L-win/XL-win)
 *   - Risk fingerprint radar (collapsed Section 9)
 *   - Full ARIA + mobile rules + loading/empty states
 *
 * V1 (/countries/[iso]) + V2-Table + V2-Narrative detail pages remain
 * reachable until PR #5 cutover.
 */

interface Props {
  params: Promise<{ iso: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { iso } = await params;
  const c = await resolveCountryBySlug(iso).catch(() => null);
  if (!c) {
    return {
      title: "Country not found — QGI Intelligence",
    };
  }
  return {
    title: `${c.name} · Tier ${c.overall_risk_tier} — Merged Preview — QGI Intelligence`,
    description: `Country risk profile for ${c.name}: Tier ${c.overall_risk_tier} (${c.curated ? "curated" : "uncurated"} event history). Merged preview shell — Family 2 build phase.`,
  };
}

export const revalidate = 3600;

// Pre-render every country slug at build time. Unknown slugs fall to
// notFound() at runtime via resolveCountryBySlug returning null.
export async function generateStaticParams() {
  const { loadCountryRisks } = await import("@/lib/country-risks");
  const { countrySlug } = await import("@/lib/slug");
  const data = await loadCountryRisks().catch(() => null);
  if (!data) return [];
  const slugs: { iso: string }[] = [];
  for (const c of Object.values(data.countries)) {
    const slug = countrySlug(c.name);
    if (slug) slugs.push({ iso: slug });
  }
  return slugs;
}

export default async function CountryMergedDetailPage({ params }: Props) {
  const { iso } = await params;
  // PR-iv (2026-05-15) — load the full payload once at the top of the
  // request. `resolveCountryBySlug` reads the same in-memory cache, so
  // we still get a single file read. Hoisting also guarantees the
  // structural-peers section (below) operates on the same snapshot as
  // the subject country (was a latent risk before this hoist when the
  // two loadCountryRisks calls could theoretically race a cache eviction).
  const allData = await loadCountryRisks().catch(() => null);
  const country = await resolveCountryBySlug(iso).catch(() => null);
  if (!country) notFound();

  // Per-L1 max salience for the country (REAL data — drives the Section 3
  // 8-row small-multiples table). Aggregates across all tier windows
  // (S/M/L/XL) and takes the max salience per L1 group, so the row reflects
  // the country's strongest signal in that L1 — not an average.
  const l1Salience: Record<string, number> = {};
  for (const tierData of Object.values(country.tiers)) {
    for (const cat of tierData.top_categories) {
      const mapping = CATEGORY_L1_MAP[cat.category];
      if (!mapping) continue;
      const score = cat.salience_score ?? cat.z_score ?? 0;
      const prev = l1Salience[mapping.group] ?? -Infinity;
      if (score > prev) l1Salience[mapping.group] = score;
    }
  }

  // Top-3 categories overall (for hero top-line + the "3 categories driving"
  // accent on the L1 table). De-dupes per-category so the same recipe doesn't
  // appear twice from the S and M tier windows.
  const seenCats = new Set<string>();
  const topCategories: Array<{
    category: string;
    salience_score: number;
    l1_group: string | null;
  }> = [];
  for (const tierData of Object.values(country.tiers)) {
    for (const cat of tierData.top_categories) {
      if (seenCats.has(cat.category)) continue;
      seenCats.add(cat.category);
      topCategories.push({
        category: cat.category,
        salience_score: cat.salience_score ?? cat.z_score ?? 0,
        l1_group: CATEGORY_L1_MAP[cat.category]?.group ?? null,
      });
    }
  }
  topCategories.sort((a, b) => b.salience_score - a.salience_score);
  const top3 = topCategories.slice(0, 3);

  // The L1 row list — fixed A..H order so the page reads as a stable
  // taxonomy (per Elif's small-multiples grid principle).
  const l1Rows = L1_GROUPS.map((g) => ({
    code: g.code,
    label: g.label,
    shortLabel: g.shortLabel,
    color: g.color,
    salience: l1Salience[g.code] ?? null,
  }));

  // PR #4 — ML recipe coverage matrix (Marcus flagship). Brief Section 4:
  //   7 cols × 13 LOCKed recipes (Recipe / Architecture / LOCO AUC /
  //   Calibration band / AHI this country / Global percentile / Status)
  //
  //   - Recipe + Architecture + LOCO AUC: REAL data from ml-recipe-stack.
  //   - Calibration band: REAL ECE from ml-recipe-stack.
  //   - AHI (this country) + Global percentile: deterministic preview
  //     values seeded on (country.id, recipe.recipe_id) until #648 sibling
  //     bake ships per-country anchor stability.
  //   - Status: derived — `measured` when AHI value present; `no anchor`
  //     otherwise.
  //
  //   Expansion policy: brief says expanded by default when ml_cov ≥ 3/13.
  //   ml_cov is the count of recipes with a non-null `anchor_ahi_value` in
  //   the bake. Since the bake currently has many null AHI values, we use
  //   a deterministic preview heuristic per country to decide expansion
  //   default — see `mlCoverageGate` below.
  const mlStack = await loadMlRecipeStack().catch(() => null);
  const mlRows = mlStack
    ? toBuyerViewList(mlStack.recipes)
        .filter((r) => mlStack.metadata.top_4_recipes.includes(r.recipe_id))
        // PR #4 keeps the matrix on the top-4 set; PR #5+ can expand to all 13
        // once the LOCKed-set roster stabilises post-KI-2.
        //
        // PR-iv (2026-05-15) Flavor A audit:
        //   - `ahi_preview` was seeded preview for every recipe; replaced with
        //     real `anchor_ahi_value` from ml-recipe-stack.json (currently
        //     present for 1 of 4 top recipes — civil_war_and_insurgency).
        //     Null AHI rows now render "—" + per-row Preview chip
        //     (the column-level chip stays as a header advisory).
        //   - `pct_preview` (global percentile) stays seeded — the bake
        //     doesn't ship this field; still Flavor B.
        //   - Both fields are scoped per-recipe, not per-country. True
        //     per-country anchor stability still requires #648 bake.
        .map((r) => {
          const rngPct = seededRng(`pct:${country.id}:${r.recipe_id}`);
          const pct_preview = Math.round(rngPct() * 100); // 0..100
          // Real AHI from the validated recipe set — null when the bake
          // hasn't measured anchor stability for this recipe yet.
          const real_ahi = r.anchor_ahi_value;
          const has_anchor = real_ahi !== null;
          return {
            recipe_id: r.recipe_id,
            display_name: r.display_name,
            architecture_label: r.architecture_label,
            loco_auc: r.loco_auc,
            ece_overall: r.ece_overall, // calibration band (REAL)
            ahi_preview: real_ahi, // PR-iv: real value, null where unmeasured
            pct_preview: has_anchor ? pct_preview : null,
            has_anchor,
          };
        })
    : [];
  const mlCovCount = mlRows.filter((r) => r.has_anchor).length;
  // Brief expansion gate: ≥3/13 = expanded; <3/13 = collapsed.
  // Operating on the top-4 set here (until #648), the threshold scales
  // proportionally — ≥1/4 (i.e. any coverage at all) flips to expanded.
  // Once the full 13 ships, this gate compares against 3.
  const mlMatrixDefaultExpanded = mlCovCount >= 1;

  // PR #4 — structural peers (Section 5). Brief: "Countries that look most
  // like {country} today" — top-5 by L1-profile similarity. We compute a
  // simple cosine-like similarity on the 8-dim L1 salience vector
  // (excluding the subject country itself). REAL data — no MOCK chip.
  // Uses `allData` hoisted at the top of the function (PR-iv) to ensure
  // peers and subject share the same bake snapshot.
  let structuralPeers: Array<{
    slug: string;
    name: string;
    alpha_2: string;
    tier: string;
    similarity: number;
  }> = [];
  if (allData) {
    const selfVec = L1_GROUPS.map((g) => l1Salience[g.code] ?? 0);
    const selfMag = Math.sqrt(selfVec.reduce((acc, v) => acc + v * v, 0));
    const peerSims: Array<{
      slug: string;
      name: string;
      alpha_2: string;
      tier: string;
      similarity: number;
    }> = [];
    if (selfMag > 0) {
      for (const [peerId, peer] of Object.entries(allData.countries)) {
        if (peerId === country.id) continue; // skip self
        const peerSlug = countrySlug(peer.name);
        if (!peerSlug) continue;
        // Build peer L1 salience vector (same logic as subject).
        const peerL1: Record<string, number> = {};
        for (const tierData of Object.values(peer.tiers)) {
          for (const cat of tierData.top_categories) {
            const mapping = CATEGORY_L1_MAP[cat.category];
            if (!mapping) continue;
            const score = cat.salience_score ?? cat.z_score ?? 0;
            const prev = peerL1[mapping.group] ?? -Infinity;
            if (score > prev) peerL1[mapping.group] = score;
          }
        }
        const peerVec = L1_GROUPS.map((g) => peerL1[g.code] ?? 0);
        const peerMag = Math.sqrt(peerVec.reduce((acc, v) => acc + v * v, 0));
        if (peerMag === 0) continue;
        // Cosine similarity — bounded [-1, 1]; for non-negative salience,
        // bounded [0, 1].
        const dot = selfVec.reduce((acc, v, i) => acc + v * peerVec[i], 0);
        const similarity = dot / (selfMag * peerMag);
        peerSims.push({
          slug: peerSlug,
          name: peer.name,
          alpha_2: peer.alpha_2,
          tier: peer.overall_risk_tier,
          similarity,
        });
      }
      peerSims.sort((a, b) => b.similarity - a.similarity);
      structuralPeers = peerSims.slice(0, 5);
    }
  }

  return (
    <CountryMergedDetail
      iso={iso}
      name={country.name}
      alpha_2={country.alpha_2}
      curated={country.curated}
      tier={country.overall_risk_tier}
      l1Rows={l1Rows}
      top3={top3}
      mlRows={mlRows}
      mlCovCount={mlCovCount}
      mlMatrixDefaultExpanded={mlMatrixDefaultExpanded}
      structuralPeers={structuralPeers}
    />
  );
}
