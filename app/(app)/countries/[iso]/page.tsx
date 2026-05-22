import { loadCountryRisks, resolveCountryBySlug } from "@/lib/country-risks";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { toBuyerViewList } from "@/lib/buyer-view";
import { CATEGORY_L1_MAP, L1_GROUPS } from "@/lib/category-taxonomy";
import { countrySlug } from "@/lib/slug";
import {
  CountryMergedDetail,
  type QgiPerRecipeEntry,
} from "@/components/countries/CountryMergedDetail";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

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
      title: "Country not found · QGI Intelligence",
    };
  }
  return {
    title: `${c.name} · Tier ${c.overall_risk_tier} · QGI Intelligence`,
    description: `Country risk profile for ${c.name}: Tier ${c.overall_risk_tier} (${c.curated ? "curated" : "uncurated"} event history). Country profile.`,
    // #699: explicit canonical so the V3 detail isn't a "duplicate of /"
    alternates: { canonical: `/countries/${iso}` },
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
  // #853 — load mlStack in parallel with allData; needed for the
  // lockedRecipeSet gate on topCategories (prevents non-LOCKed categories
  // like "military_coup" from appearing in the auto-narrative).
  const [allData, mlStackEarly] = await Promise.all([
    loadCountryRisks().catch(() => null),
    loadMlRecipeStack().catch(() => null),
  ]);
  let country = await resolveCountryBySlug(iso).catch(() => null);
  // #714 (2026-05-16) — Dashboard and landing page link to /countries/{id}
  // using NUMERIC country IDs (e.g., `/countries/205`). Pre-fix that
  // produced a notFound() 404 + the in-shell fallback page's "Precedents"
  // CTA — which 2 personas (James/FT + Fatima/UN) mis-read as
  // "the country page redirected me to /precedents." Real bug per the
  // #714 root-cause investigation: numeric IDs aren't a route format.
  //
  // Fix: accept BOTH numeric ID and slug. If iso is purely numeric AND
  // a country exists at that ID, permanent-redirect to its canonical
  // slug-based URL. Slugs remain the canonical form (sitemap, links
  // generated by /countries list/cards, dashboard cards once they
  // migrate). Numeric IDs become a stable alias that always resolve.
  if (!country && /^\d+$/.test(iso) && allData) {
    const numericMatch = allData.countries[iso];
    if (numericMatch) {
      const canonicalSlug = countrySlug(numericMatch.name);
      // Defense-in-depth: `canonicalSlug !== iso` guard. countrySlug()
      // produces alpha-only slugs from country names, so a numeric `iso`
      // can never equal the canonical slug in real data. Belt + suspenders.
      if (canonicalSlug && canonicalSlug !== iso) {
        permanentRedirect(`/countries/${canonicalSlug}`);
      }
      // Attach the id so the shape matches what `resolveCountryBySlug`
      // returns (the dict key is the id).
      country = { id: iso, ...numericMatch };
    }
  }

  // #759 (persona-test 2026-05-17) — canonical-URL polish for hyphen
  // variants. `resolveCountryBySlug` was extended in this PR with
  // hyphen→underscore normalization (lib/country-risks.ts) so it now
  // resolves `/countries/dr-congo` to the DRC entry by normalizing to
  // `dr_congo` → COMMON_NAME_ALIASES → canonical. That keeps the route
  // from 404ing. The 308 below additionally rewrites the URL bar to
  // the canonical underscore slug so bookmarks, analytics, and the
  // sitemap stay consistent.
  if (country && /-/.test(iso)) {
    const canonicalSlug = countrySlug(country.name);
    if (canonicalSlug && canonicalSlug !== iso) {
      permanentRedirect(`/countries/${canonicalSlug}`);
    }
  }

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
  //
  // #853 — gate to LOCKed ML recipes only. The statistical layer (71 categories)
  // includes categories with no ML-validated recipe (e.g. "military_coup" for
  // Qatar). The WhatsHappeningHere narrative cited these without distinction,
  // misleading readers about ML-validation status. Apply lockedRecipeSet filter
  // so only the 4 LOCKed ML recipe categories appear in the auto-narrative.
  // If fewer than 3 LOCKed categories rank in the top, the narrative will be
  // shorter — acceptable per triage note. The full statistical layer is still
  // disclosed in the "Categories above are drawn from QGI's statistical
  // alignment layer" note below the narrative.
  const lockedRecipeSetEarly = new Set(mlStackEarly?.metadata.top_4_recipes ?? []);
  const seenCats = new Set<string>();
  const topCategories: Array<{
    category: string;
    salience_score: number;
    l1_group: string | null;
    /** #696 (2026-05-18): recipe_count from the source bake — when < 5
     *  the category's salience did NOT drive the country's risk tier
     *  (#201 recipe-count gate). UI badges these as "evidence-thin" so
     *  a reader doesn't assume a 2-recipe outlier caused the tier. */
    recipe_count: number;
  }> = [];
  for (const tierData of Object.values(country.tiers)) {
    for (const cat of tierData.top_categories) {
      // #853 — skip categories not in the LOCKed ML recipe set.
      if (!lockedRecipeSetEarly.has(cat.category)) continue;
      if (seenCats.has(cat.category)) continue;
      seenCats.add(cat.category);
      topCategories.push({
        category: cat.category,
        salience_score: cat.salience_score ?? cat.z_score ?? 0,
        l1_group: CATEGORY_L1_MAP[cat.category]?.group ?? null,
        recipe_count: cat.recipe_count,
      });
    }
  }
  topCategories.sort((a, b) => b.salience_score - a.salience_score);
  const top3 = topCategories.slice(0, 3);

  // #842 — derive top1 from the same L1-salience map that drives the bar chart,
  // so the narrative and bar chart agree. Find the L1 group with highest max salience.
  const top1L1 = L1_GROUPS.reduce<(typeof L1_GROUPS)[number] | null>((best, g) => {
    if (!best) return g;
    return (l1Salience[g.code] ?? -Infinity) > (l1Salience[best.code] ?? -Infinity)
      ? g
      : best;
  }, null);
  const top1L1Label: string | null =
    top1L1 && l1Salience[top1L1.code] != null ? top1L1.label : null;

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
  // #853 — reuse the mlStackEarly loaded at the top of the function (parallel
  // with allData). Avoids a second fs read of ml-recipe-stack.json.
  const mlStack = mlStackEarly;
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
  // like {country} today" — top-5 by L1-profile similarity.
  //
  // #717 (2026-05-16) — face-validity fix. The prior implementation
  // computed cosine similarity on the 8-dim L1 salience vector with
  // missing dimensions zero-filled. Because most countries have only
  // 2-4 active L1 domains (the remaining 4-6 dims are silently zero on
  // BOTH sides), cosine collapsed to "how aligned are countries on the
  // 1-2 dimensions they happen to share" — producing degenerate matches
  // like Germany≈Qatar 0.98, Lithuania≈Ghana 0.98, Vietnam≈Saudi Arabia
  // 0.96. Multiple 2026-05-15 persona tests (James/FT + Dmitri/HF +
  // Marcus/CRO) bounced off the panel on first sight; all three called
  // it a dealbreaker.
  //
  // The fix is a two-gate filter + intersection-only cosine, composed
  // with the Jaccard overlap:
  //   1. Jaccard ≥ 0.5 on active-L1 sets (must share at least half their
  //      risk fingerprint to be considered a peer)
  //   2. intersection length ≥ 3 (must share at least 3 active L1
  //      dimensions; eliminates the 1-dimension-coincidence pairs)
  //   3. cosine on the intersection only (no zero-fill on missing dims;
  //      missing data is now "drop" not "match-zero-with-zero")
  //   4. composite = jaccard × cosine (structural-overlap × intensity-
  //      similarity, so a 3-dim 0.99-cosine match scores below a 6-dim
  //      0.85-cosine match — more shared structure dominates pure
  //      angular alignment in a low-dim space)
  //   5. Math.max(0, score) defensive clamp on salience values to avoid
  //      negative salience feeding the intersection cosine (would
  //      produce non-monotone composite scores)
  //
  // Face-validity assertions encoded in tests:
  //   - Germany's top-5 must contain ≥3 of {UK, France, Netherlands,
  //     Belgium, Switzerland, Austria, Sweden, Denmark} (no Persian Gulf
  //     states)
  //   - Vietnam's top-5 must contain ≥2 of {Thailand, Indonesia,
  //     Philippines, Malaysia, Cambodia, China}
  //   - Lithuania's top-5 does not contain Ghana
  //
  // Uses `allData` hoisted at the top of the function (PR-iv) to ensure
  // peers and subject share the same bake snapshot.
  // Gates Rank 6 (Santiago R3 + Mei-Lin R5 + 9 more persona-rounds):
  // similarity number alone is not citable. Carry the per-dimension
  // breakdown so the UI expander can show "the 89% match is driven by
  // Economic Stress (35%) + Political Power (25%) + Conflict (18%)…"
  let structuralPeers: Array<{
    slug: string;
    name: string;
    alpha_2: string;
    tier: string;
    similarity: number;
    breakdown?: Array<{
      code: string;
      label: string;
      contribution_pct: number;
    }>;
  }> = [];
  if (allData) {
    // Subject's active L1 set (positive-salience dimensions only).
    const selfActive = new Set(
      Object.keys(l1Salience).filter((k) => Math.max(0, l1Salience[k] ?? 0) > 0)
    );
    const peerSims: Array<{
      slug: string;
      name: string;
      alpha_2: string;
      tier: string;
      similarity: number;
      breakdown?: Array<{
        code: string;
        label: string;
        contribution_pct: number;
      }>;
    }> = [];
    if (selfActive.size >= 3) {
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
        // Peer's active L1 set.
        const peerActive = new Set(
          Object.keys(peerL1).filter((k) => Math.max(0, peerL1[k] ?? 0) > 0)
        );
        // Gate 1: Jaccard ≥ 0.5 — structural overlap.
        const intersection = [...selfActive].filter((k) => peerActive.has(k));
        const union = new Set([...selfActive, ...peerActive]);
        if (union.size === 0) continue;
        const jaccard = intersection.length / union.size;
        if (jaccard < 0.5) continue;
        // Gate 2: ≥3 shared active L1s — eliminate 1-2-dim coincidences.
        if (intersection.length < 3) continue;
        // Intersection-only cosine on positive-clamped salience values.
        const va = intersection.map((k) => Math.max(0, l1Salience[k] ?? 0));
        const vb = intersection.map((k) => Math.max(0, peerL1[k] ?? 0));
        const dot = va.reduce((acc, v, i) => acc + v * vb[i], 0);
        const ma = Math.sqrt(va.reduce((acc, v) => acc + v * v, 0));
        const mb = Math.sqrt(vb.reduce((acc, v) => acc + v * v, 0));
        if (ma === 0 || mb === 0) continue;
        // Composite: Jaccard structural overlap × intersection cosine.
        // Bounded [0, 1]. A 3-dim match with cosine 0.99 scores 0.5×0.99 =
        // 0.495; a 6-dim match with cosine 0.85 scores 0.75×0.85 = 0.638.
        const cosine = dot / (ma * mb);
        const similarity = jaccard * cosine;

        // Gates Rank 6 — per-dimension contribution to the cosine. Each
        // intersection-dim's pairwise product (va[i] * vb[i]) divided by
        // (ma * mb) sums to the cosine. Express as % of cosine so the
        // breakdown reads as "this dimension contributed 35% of the
        // similarity score." Sorted desc; clipped to top 5 (rest folded
        // into a "+N more" tail in the UI).
        const breakdown = intersection
          .map((k, i) => ({
            code: k,
            label: L1_GROUPS.find((g) => g.code === k)?.label ?? k,
            contribution_pct: cosine > 0 ? (va[i] * vb[i]) / (ma * mb) / cosine : 0,
          }))
          .sort((a, b) => b.contribution_pct - a.contribution_pct)
          .map((b) => ({ ...b, contribution_pct: Math.round(b.contribution_pct * 100) }))
          // Drop sub-1% contributors so they don't bloat the "+N more" tail
          // (Sonnet review on PR #113, finding #1). Also implicitly handles
          // the zero-cosine edge case — when cosine === 0 every entry rounds
          // to 0 and the filter empties the breakdown, suppressing the
          // expander entirely via the length-guard in the component.
          .filter((b) => b.contribution_pct > 0);

        peerSims.push({
          slug: peerSlug,
          name: peer.name,
          alpha_2: peer.alpha_2,
          tier: peer.overall_risk_tier,
          similarity,
          breakdown,
        });
      }
      peerSims.sort((a, b) => b.similarity - a.similarity);
      structuralPeers = peerSims.slice(0, 5);
    }
  }

  // #721 Step 2 — pass QGI Risk Score to the detail component. Fields
  // are `.optional()` in the schema so countries from older bakes
  // (pre-2026-05-16) gracefully render the prior hero (tier pill only).
  const riskScore =
    country.qgi_risk_score_0_100 !== undefined && country.coverage_flag !== undefined
      ? {
          score: country.qgi_risk_score_0_100,
          ci_low: country.qgi_risk_score_ci_low ?? null,
          ci_high: country.qgi_risk_score_ci_high ?? null,
          coverage_flag: country.coverage_flag,
        }
      : undefined;

  // #729 Step 2 — per-recipe Precedent Match strip data. Optional same as
  // riskScore; pre-#728-Step-1 bakes don't carry the block. The strip is
  // hidden when the country has no per-recipe scores at all (all-null).
  //
  // R8 Priya BUG-2 (2026-05-20) — enrich each recipe entry with a
  // `cohort_rank` so the strip can display "97/100 (#4 of 127)".
  // Rank = 1-based descending position of this country's score among all
  // countries that have coverage_flag="ok" for the same recipe. Computed
  // here (server-side, deterministic per bake) so the client component
  // stays pure. Skip when coverage_flag !== "ok" per spec.
  const rawPerRecipe = country.qgi_risk_score_by_recipe;
  let perRecipe: Record<string, QgiPerRecipeEntry | null> | undefined = rawPerRecipe;
  if (rawPerRecipe && allData) {
    const enriched: Record<string, QgiPerRecipeEntry | null> = {};
    for (const [recipeId, entry] of Object.entries(rawPerRecipe)) {
      if (entry === null || entry.coverage_flag !== "ok") {
        enriched[recipeId] = entry;
        continue;
      }
      // Collect all ok-coverage scores for this recipe across the cohort.
      const allScores: number[] = [];
      for (const c of Object.values(allData.countries)) {
        const rEntry = c.qgi_risk_score_by_recipe?.[recipeId];
        if (rEntry && rEntry.coverage_flag === "ok") {
          allScores.push(rEntry.score);
        }
      }
      // Sort descending; rank 1 = highest score.
      allScores.sort((a, b) => b - a);
      const rank = allScores.indexOf(entry.score) + 1;
      // Sonnet PR #129 NIT: use the cohort size we actually ranked
      // against (allScores.length) rather than the pipeline-baked
      // `cohort_n_recipe`, so the displayed "#N of M" never disagrees
      // with the rank-N's actual denominator.
      enriched[recipeId] = {
        ...entry,
        cohort_rank: rank > 0 ? rank : undefined,
        cohort_n_recipe: allScores.length,
      };
    }
    perRecipe = enriched;
  }

  // #757 (persona-test 2026-05-17): surface bake date alongside the
  // "Auto-generated" status chip in WhatsHappeningHere. The dataset's
  // top-level `generated_at` is an ISO-8601 timestamp; we keep only the
  // YYYY-MM-DD date portion for the chip (timezone + sub-second precision
  // is noise at this granularity).
  const bakeDate = allData?.generated_at ? allData.generated_at.slice(0, 10) : undefined;

  return (
    <CountryMergedDetail
      iso={iso}
      name={country.name}
      alpha_2={country.alpha_2}
      curated={country.curated}
      tier={country.overall_risk_tier}
      l1Rows={l1Rows}
      top3={top3}
      top1L1Label={top1L1Label}
      mlRows={mlRows}
      mlCovCount={mlCovCount}
      mlMatrixDefaultExpanded={mlMatrixDefaultExpanded}
      structuralPeers={structuralPeers}
      riskScore={riskScore}
      perRecipe={perRecipe}
      bakeDate={bakeDate}
    />
  );
}
