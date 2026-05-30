/**
 * /patterns — Cascade pair-pattern catalogue.
 *
 * Rebuilt 2026-05-30. Replaces the honest-empty-state stub.
 *
 * Data sources (cascade-era only, no TE / Analogues mixing):
 *   - data/ranking.json          — top-1000 algorithmic pair windows
 *   - data/country-partners-index.json — 215-country partner index
 *   - data/cascade-patterns-featured.json — 12 Selene-curated pairs
 *
 * Layout (Sara Ahmed / Sard majles 2026-05-30):
 *   1. Hero: h1 + 2-line subtitle + vintage stamp
 *   2. Featured strip: 12 curated pair cards in a 2-3 col responsive grid
 *   3. Search + filter interface + paginated results list
 *
 * V4.1 §0 confidence-first. Flag images on every country. No em-dashes.
 * No kicker-chip spam. No methodology jargon.
 */

import type { Metadata } from "next";
import { Layers } from "lucide-react";
import {
  getCatalogue,
  getFeaturedPairs,
  getCascadeVintage,
} from "@/lib/cascade-patterns/patterns-data";
import { FeaturedPairsStrip } from "@/components/patterns-v4/FeaturedPairsStrip";
import { PatternsSearch } from "@/components/patterns-v4/PatternsSearch";

export const metadata: Metadata = {
  title: "Pair Patterns · QG Intelligence",
  description:
    "Country pairs whose indicator-composite histories ran in close parallel over shared multi-decade windows. The algorithmic cascade catalogue, ranked by pair strength.",
};

export default function PatternsPage() {
  const catalogue = getCatalogue();
  const featured = getFeaturedPairs();
  const vintage = getCascadeVintage();

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
            Pair patterns
          </h1>

          <p
            style={{
              fontSize: "15px",
              color: "var(--qgi-text-muted)",
              lineHeight: 1.6,
              margin: "0 0 16px",
              maxWidth: "640px",
            }}
          >
            Country pairs whose recent paths rhyme. Browse the algorithmic catalogue or
            jump to a featured finding.
          </p>

          {/* Vintage stamp */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "10.5px",
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-text-dim)",
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "4px",
              padding: "4px 10px",
            }}
          >
            <span>Cascade vintage: {vintage.label}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>
              {catalogue.length} pair{catalogue.length !== 1 ? "s" : ""}
            </span>
          </div>
        </header>

        {/* ── Featured pairs ───────────────────────────────────────────────── */}
        <section style={{ marginBottom: "40px" }}>
          <h2
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#5B7E99",
              margin: "0 0 14px",
              letterSpacing: "0.1px",
            }}
          >
            Featured pairs
          </h2>
          <p
            style={{
              fontSize: "12px",
              color: "var(--qgi-text-dim)",
              margin: "0 0 16px",
              lineHeight: 1.5,
            }}
          >
            Twelve pairs selected for cross-regional surprise, structural depth, and
            geographic distance.
          </p>
          <FeaturedPairsStrip pairs={featured} />
        </section>

        {/* ── Catalogue search ─────────────────────────────────────────────── */}
        <section>
          <h2
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#5B7E99",
              margin: "0 0 14px",
              letterSpacing: "0.1px",
            }}
          >
            Full catalogue
          </h2>
          <PatternsSearch entries={catalogue} />
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer
          style={{
            marginTop: "40px",
            paddingTop: "18px",
            borderTop: "1px solid var(--qgi-border)",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            lineHeight: 1.6,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          Cascade vintage {vintage.label}. Pair-pattern scores are algorithmic outputs
          from a structural-correlation run across the QGI indicator library. Next cascade
          re-bake in progress.
        </footer>
      </div>
    </div>
  );
}
