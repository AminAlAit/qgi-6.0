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
import Link from "next/link";
import type { Route } from "next";
import { Layers } from "lucide-react";
import {
  getCatalogue,
  getPartnersIndex,
  getFeaturedPairs,
  getCascadeVintage,
  getTierCounts,
} from "@/lib/cascade-patterns/patterns-data";
import { getMockedPatternSlugs, getPatternMeta } from "@/lib/cascade-patterns/scdi-mock";
import { FeaturedPairsStrip } from "@/components/patterns-v4/FeaturedPairsStrip";
import { PatternsSearch } from "@/components/patterns-v4/PatternsSearch";

export const metadata: Metadata = {
  title: "Pair Patterns · QG Intelligence",
  description:
    "Country pairs whose indicator-composite histories ran in close parallel over shared multi-decade windows. The algorithmic cascade catalogue, ranked by pair strength.",
};

export default function PatternsPage() {
  const catalogue = getCatalogue();
  const fullCorpus = getPartnersIndex();
  const featured = getFeaturedPairs();
  const vintage = getCascadeVintage();
  const tierCounts = getTierCounts();
  const mockedSlugs = getMockedPatternSlugs();

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
            <span>{fullCorpus.length.toLocaleString()} pairs</span>
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
          <PatternsSearch
            entries={catalogue}
            fullCorpus={fullCorpus}
            tierCounts={tierCounts}
          />
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

        {/* DEV mock-pattern cluster — remove when backend ships pattern-scdis.json */}
        <div
          style={{
            marginTop: "32px",
            paddingTop: "14px",
            borderTop: "1px dashed var(--qgi-border)",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-text-dim)",
              letterSpacing: "1.4px",
              fontWeight: 600,
              marginBottom: "10px",
            }}
          >
            DEV · 15 MOCK PATTERNS (QA ONLY)
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
            }}
          >
            {mockedSlugs.map((slug) => {
              const m = getPatternMeta(slug);
              const label = m
                ? `${m.a_iso2.toUpperCase()}/${m.b_iso2.toUpperCase()} ${m.start_year}${m.start_year_b !== undefined ? "/" + m.start_year_b : ""}${m.start_year_b !== undefined ? " +" + Math.abs(m.offset_years ?? 0) + "y" : ""}`
                : slug;
              return (
                <Link
                  key={slug}
                  href={`/patterns/${slug}` as Route}
                  style={{
                    fontSize: "10px",
                    fontFamily: "ui-monospace, monospace",
                    color: "var(--qgi-text-dim)",
                    background: "var(--qgi-surface)",
                    border: "1px solid var(--qgi-border)",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    textDecoration: "none",
                    opacity: 0.75,
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
