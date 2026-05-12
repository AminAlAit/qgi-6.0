/**
 * DISCOVER PATTERNS — V2.2 (Facets)
 *
 * Elif Şahin-Moreau variant. Sard Majles S-First decision (2026-05-01):
 * Facets reveal structure where tabs hide it. The user filters a
 * comprehensive small-multiples grid; they do not navigate between modes.
 *
 * Design principles (Tufte-first):
 *   1. Data-ink priority. Every pixel earns its place.
 *   2. Small-multiples grid (20-32 cards) as the permanent center.
 *      Tabs would serialize a structure that is naturally parallel.
 *   3. Facet column is left-anchored — persistent, spatial, not modal.
 *   4. Sparklines in grid cells: correlation trajectory over 7 points.
 *      No chartjunk. No axes on sparklines — the shape IS the message.
 *   5. Sort control in the grid header, not buried in a filter.
 *   6. Click-through to /[slug] for the full data dossier.
 *
 * Data: MOCK (patterns-facets-mock.json). Real data integration in #648.
 *
 * Decision file:
 *   qgi-docs/internal/majles/2026-05-01_S-First_patterns_ranking_merge.md
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import { FacetedGrid } from "./FacetedGrid";
import type { PatternFacet } from "./types";

export const metadata: Metadata = {
  title: "Discover Patterns — V2 Facets — QGI Intelligence",
  robots: { index: false, follow: false },
};

// MOCK: loaded server-side from baked JSON; real data integration in #648.
async function loadPatterns(): Promise<PatternFacet[]> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "patterns-facets-mock.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(raw) as { patterns: PatternFacet[] };
    return json.patterns ?? [];
  } catch {
    return [];
  }
}

export const revalidate = 3600;

export default async function DiscoverPatternsFacetsPage() {
  const patterns = await loadPatterns();

  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center h-full text-[10px] tracking-widest uppercase"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Loading patterns…
        </div>
      }
    >
      <FacetedGrid patterns={patterns} />
    </Suspense>
  );
}
