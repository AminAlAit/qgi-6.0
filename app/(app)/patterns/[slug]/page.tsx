import { PatternMergedDetail } from "@/components/patterns/PatternMergedDetail";
import { countrySlug } from "@/lib/slug";
import type { PatternRow } from "@/lib/types";
import {
  computePatternTrajectory,
  type PatternTrajectory,
  type VerifiedEvent,
} from "@/lib/pattern-trajectory";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/** #840 — Load verified events, keyed by lowercase country name. */
async function loadVerifiedEventsByCountry(): Promise<Map<string, VerifiedEvent[]>> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "verified-events.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const json: unknown = JSON.parse(raw);
    if (!Array.isArray(json)) return new Map();
    const byCountry = new Map<string, VerifiedEvent[]>();
    for (const item of json as VerifiedEvent[]) {
      if (!item || typeof item.country !== "string" || typeof item.year !== "number")
        continue;
      const key = item.country.toLowerCase();
      const bucket = byCountry.get(key);
      if (bucket) bucket.push(item);
      else byCountry.set(key, [item]);
    }
    return byCountry;
  } catch {
    return new Map();
  }
}

/**
 * /patterns/[slug] — Per-pattern detail page for Family 4 of A3 brief.
 *
 * Build PR #3 of 5 (founder-gated cutover at PR #5).
 *
 * Slug shape: `{a-slug}-{b-slug}-{start_year_a}-{start_year_b}` e.g.
 * `paraguay-south_korea-1963-1962`. The two trailing 4-digit years
 * disambiguate same-pair windows that share start_year_a but differ in
 * the partner's start year. Note: `countrySlug()` uses underscores for
 * spaces, so multi-word country names render as e.g. `south_korea`.
 * Slug separator is a hyphen between segments only.
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   (Family 4 — Patterns / detail page composition lines ~1195-1400)
 *
 * Scope of PR #3 (Tufte-minimal — full 11-section spec carved down):
 *   - Breadcrumb (Home / Patterns / {pair})
 *   - Hero — eyebrow + h1 "{a} → {b}" + chip cluster (Verified-data label
 *     + Window-tier pill + Architecture preview-chip + RCI preview-dot)
 *   - Section 1 "What's the claim" Ingrid 90-110w 3-movement lede
 *   - Section 2 "What this doesn't mean" 3-bullet callout (REQUIRED)
 *   - Section 3 — Signal summary 7-stat strip (REAL columns: Correlation,
 *     Pattern Power, Length, Shared indicators, Start years, Predicted-flag;
 *     placeholder columns: Out-of-country discrimination, Calibration band)
 *   - Cross-family handoffs footer (back to /patterns · /precedents-
 *     merged · /countries for each side of pair · /signals)
 *   - Page footer with V1.9.1 scoring tag
 *
 * Deferred to PR #4: ECharts trajectory chart, sparkline column, RCI prose
 * dossier, full 11-section spec with mechanism narrative + historical
 * analogues + coverage bias.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

interface RankingPayload {
  results: PatternRow[];
  generated_at?: string;
}

async function loadRanking(): Promise<RankingPayload> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "ranking.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const json: unknown = JSON.parse(raw);
    if (
      !json ||
      typeof json !== "object" ||
      !Array.isArray((json as { results?: unknown }).results)
    ) {
      return { results: [] };
    }
    return {
      results: (json as { results: PatternRow[] }).results,
      generated_at: (json as { generated_at?: string }).generated_at,
    };
  } catch {
    return { results: [] };
  }
}

/** Resolve the slug against the loaded ranking data. */
function resolveBySlug(slug: string, rows: ReadonlyArray<PatternRow>): PatternRow | null {
  // Build canonical "<aSlug>-<bSlug>-<startA>-<startB>" per row and exact-
  // match against the request slug. Same-pair windows sharing both start
  // years collide on this key; we accept that as the analytical unit
  // (correlation + length differ on instance-level only — out of PR #3 scope).
  for (const r of rows) {
    const a = countrySlug(r.country_a) ?? r.country_a.toLowerCase();
    const b = countrySlug(r.country_b) ?? r.country_b.toLowerCase();
    if (`${a}-${b}-${r.start_year_a}-${r.start_year_b}` === slug) return r;
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const payload = await loadRanking();
  const rows = payload.results;
  const row = resolveBySlug(slug, rows);
  if (!row) {
    return {
      title: "Pattern not found · QG Intelligence",
    };
  }
  return {
    title: `${row.country_a} → ${row.country_b} · Patterns · QG Intelligence`,
    description: `Per-pattern detail for ${row.country_a} → ${row.country_b}: a ${row.pattern_length}-year window starting ${row.start_year_a} on ${row.num_indexes} shared indicators (avg correlation ${(row.avg_correlation * 100).toFixed(1)}%).`,
    // #699: explicit canonical.
    alternates: { canonical: `/patterns/${slug}` },
  };
}

export const revalidate = 3600;

export async function generateStaticParams() {
  const payload = await loadRanking();
  const rows = payload.results;
  // Pre-render the top 100 patterns. Anything beyond falls through to
  // notFound() at runtime if directly URL-typed.
  const params: { slug: string }[] = [];
  for (const r of rows.slice(0, 100)) {
    const a = countrySlug(r.country_a) ?? r.country_a.toLowerCase();
    const b = countrySlug(r.country_b) ?? r.country_b.toLowerCase();
    params.push({ slug: `${a}-${b}-${r.start_year_a}-${r.start_year_b}` });
  }
  return params;
}

export type PatternWindowTier = "S-win" | "M-win" | "L-win" | "XL-win";

function mapPatternTier(raw: string | undefined): PatternWindowTier {
  if (raw === "XL") return "XL-win";
  if (raw === "L") return "L-win";
  if (raw === "M") return "M-win";
  return "S-win";
}

export default async function PatternDetailPage({ params }: Props) {
  const { slug } = await params;
  // #840 — load events in parallel with ranking (independent fs reads).
  // #849 — also load ml recipe stack for falsification anchor link guard.
  const [payload, eventsByCountry, mlStack] = await Promise.all([
    loadRanking(),
    loadVerifiedEventsByCountry(),
    loadMlRecipeStack().catch(() => null),
  ]);
  // #849 — LOCKed ML recipe set for falsification anchor link guard.
  const lockedRecipeSet: ReadonlySet<string> = new Set(
    mlStack?.metadata.top_4_recipes ?? []
  );
  const rows = payload.results;
  const row = resolveBySlug(slug, rows);
  if (!row) notFound();

  const tier = mapPatternTier(row.pattern_tier);
  const aSlug = countrySlug(row.country_a) ?? row.country_a.toLowerCase();
  const bSlug = countrySlug(row.country_b) ?? row.country_b.toLowerCase();
  // PR-iv — real bake date (Flavor A).
  const generatedDate = payload.generated_at
    ? payload.generated_at.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // #840 — compute trajectory for this specific pattern (same path as list page).
  const trajectory: PatternTrajectory = computePatternTrajectory(
    row,
    eventsByCountry.get(row.country_a.toLowerCase()) ?? []
  );

  return (
    <PatternMergedDetail
      row={row}
      tier={tier}
      aSlug={aSlug}
      bSlug={bSlug}
      generatedDate={generatedDate}
      trajectory={trajectory}
      lockedRecipeSet={lockedRecipeSet}
    />
  );
}
