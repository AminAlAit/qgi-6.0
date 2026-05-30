/**
 * /patterns — Pattern search engine.
 *
 * Rebuilt 2026-05-30. Clean search engine surface only.
 * No featured strips, no recently-surfaced, no vintage stamps, no editorial sections.
 *
 * Data sources (cascade-era only):
 *   - data/ranking.json          — top-1000 algorithmic windows (start years available)
 *   - data/country-partners-index.json — 215-country partner index (~23k entries)
 *
 * Layout:
 *   Hero (h1 + one-line subtitle) + search engine (filters left, results right).
 *
 * V4.1 §0 confidence-first. Layers icon at page-top kicker (matches sidebar).
 * No "pair" in user copy. No vintage stamp. No DEV cluster.
 * 2026-05-30
 */

import type { Metadata } from "next";
import { Layers } from "lucide-react";
import {
  getCatalogue,
  getPartnersIndex,
  getTierCounts,
  getCountryNames,
} from "@/lib/cascade-patterns/patterns-data";
import { PatternsSearch } from "@/components/patterns-v4/PatternsSearch";

export const metadata: Metadata = {
  title: "Patterns · QG Intelligence",
  description:
    "Search 23,000 structural patterns across 215 countries. Filter by country, pattern length, and start year.",
};

export default function PatternsPage() {
  const catalogue = getCatalogue();
  const fullCorpus = getPartnersIndex();
  const tierCounts = getTierCounts();
  const countryNames = getCountryNames();

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 24px 64px" }}>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <header style={{ marginBottom: "32px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--qgi-accent)",
              fontSize: "10px",
              letterSpacing: "4px",
              textTransform: "uppercase",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "10px",
            }}
          >
            <Layers size={12} strokeWidth={2} />
            PATTERNS
          </div>

          <h1
            style={{
              fontSize: "clamp(26px, 4vw, 42px)",
              fontWeight: 800,
              margin: "0 0 12px",
              lineHeight: 1.1,
              letterSpacing: "-0.5px",
              maxWidth: "700px",
            }}
          >
            Patterns
          </h1>

          <p
            style={{
              fontSize: "15px",
              color: "var(--qgi-text-muted)",
              lineHeight: 1.6,
              margin: 0,
              maxWidth: "580px",
            }}
          >
            Two countries whose indicator-composite histories ran in close parallel over a
            shared multi-decade window. Browse {fullCorpus.length.toLocaleString()}{" "}
            structural patterns across 215 countries.
          </p>
        </header>

        {/* ── Search engine ────────────────────────────────────────────────── */}
        <PatternsSearch
          entries={catalogue}
          fullCorpus={fullCorpus}
          tierCounts={tierCounts}
          countryNames={countryNames}
        />
      </div>
    </div>
  );
}
