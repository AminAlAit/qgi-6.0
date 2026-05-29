/**
 * Dashboard — V4.1 confidence-first rebuild (2026-05-29).
 *
 * Per qgi-v4-1-ux-rules.md §0 and §7, and the founder's 37-comment review:
 *
 *   "Everything in the dashboard is like as if we want to give zero
 *    confidence to the user. The design has self-killing honesty.
 *    Please change this philosophy. This is too exposing, and not selling
 *    at all!"
 *
 * The replacement is a showroom, not an operations log:
 *
 *   1. Header strip: "How to read this" + "Data Last Updated YYYY-MM-DD"
 *      (one vintage stamp per session, per rule §2; new label per #5).
 *   2. Punchy h1, one sentence subtitle. No eyebrow, no methodology wall.
 *   3. 5 catalog-size hero tiles (recipes in catalog, countries scored,
 *      signals tracked, country pairs surfaced, vintages logged). No
 *      "Validated 0" tile, no banned vocab.
 *   4. 4 insight plots that invoke curiosity (coverage, family donut,
 *      indicator-corpus stack, top historical resemblances).
 *   5. World-facing activity rows (country movements, recipe leaders,
 *      analog spotlights) — replaces the R&D walk feed.
 *
 * Sidebar untouched (other agent's scope). Recipe/Country pages untouched.
 */

import type { Metadata } from "next";
import { getAllRecipes } from "@/lib/te-mock/recipes";
import {
  HERO_TILES_V41,
  buildHeroCountsV41,
  buildFamilyDistribution,
  buildCoverageSummary,
  buildIndicatorCorpusStack,
  buildTopPairTeasers,
  buildWorldActivityRows,
} from "@/lib/te-mock/dashboard-v4-1-data";
import { DashboardHero } from "@/components/dashboard-v4-1/DashboardHero";
import {
  CoverageMapPlot,
  FamilyDistributionPlot,
  IndicatorCorpusPlot,
  TopPairTeaserPlot,
} from "@/components/dashboard-v4-1/InsightPlots";
import { WorldActivity } from "@/components/dashboard-v4-1/WorldActivity";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";

export const metadata: Metadata = {
  title: "Dashboard · QG Intelligence",
  description:
    "Country risk, compared to history. Catalog coverage, signal sources, and what's moving this vintage.",
};

export default function DashboardV41Page() {
  const recipes = getAllRecipes();
  const heroCounts = buildHeroCountsV41(recipes);
  const familyDistrib = buildFamilyDistribution();
  const coverage = buildCoverageSummary();
  const corpus = buildIndicatorCorpusStack();
  const pairs = buildTopPairTeasers(3);
  const activity = buildWorldActivityRows();

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "20px 24px 64px" }}>
        {/* ── Top strip: "How to read this" button only ──────────────────── */}
        {/* V4.1 §2 — vintage stamp moved 2026-05-29 from this header strip
            into the sidebar (below "Take the tour") so it renders once per
            session across every page, not per-page on the dashboard. */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginBottom: "28px",
            gap: "6px",
          }}
        >
          <HowToReadButton routeKey="dashboard-v4.1" />
        </div>

        {/* ── Hero: short, sales-y h1 + one-sentence subtitle ────────────── */}
        <section style={{ marginBottom: "28px" }}>
          <h1
            style={{
              fontSize: "38px",
              fontWeight: 600,
              lineHeight: 1.1,
              margin: "0 0 12px",
              maxWidth: "780px",
              letterSpacing: "-0.5px",
            }}
          >
            Country risk, compared to history.
          </h1>
          <p
            style={{
              color: "var(--qgi-text-muted)",
              fontSize: "15px",
              lineHeight: 1.55,
              margin: 0,
              maxWidth: "720px",
            }}
          >
            Every country, scored against the shapes that preceded the events that matter
            — and shown alongside the historical cases it most resembles.
          </p>
        </section>

        {/* ── Hero tiles: 5 catalog-size confidence metrics ──────────────── */}
        <section data-tour="hero-tiles">
          <DashboardHero tiles={HERO_TILES_V41(heroCounts)} />
        </section>

        {/* ── Insight plots: 4 audience-facing summary visuals ──────────── */}
        <section
          data-tour="insight-plots"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
            gap: "0px 24px",
            marginTop: "8px",
          }}
        >
          <CoverageMapPlot data={coverage} />
          <FamilyDistributionPlot slices={familyDistrib} />
          <IndicatorCorpusPlot stats={corpus} />
          <TopPairTeaserPlot pairs={pairs} />
        </section>

        {/* ── World-facing activity: what's moving this vintage ─────────── */}
        <section data-tour="world-activity">
          <WorldActivity rows={activity} />
        </section>

        {/* ── Footer: catalog scope + provenance ────────────────────────── */}
        <footer
          style={{
            marginTop: "32px",
            paddingTop: "20px",
            borderTop: "1px solid var(--qgi-border)",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            lineHeight: 1.6,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {heroCounts.recipes_total} recipes across {familyDistrib.length} risk families ·{" "}
          {heroCounts.indicators_tracked} signals tracked · {heroCounts.countries_scored}{" "}
          countries scored.
        </footer>
      </div>
    </div>
  );
}
