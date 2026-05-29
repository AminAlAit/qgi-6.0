/**
 * Dashboard — V4.1 confidence-first rebuild (2026-05-29).
 *
 * 2026-05-30 layout amendment (Sara Ahmed / Sard mini-majles):
 *   - The "Today across the catalog" strip moves from an inline-stacked slot
 *     between the insight plots and WorldActivity into a sticky right-side
 *     rail (320px) that holds the curated 20-pair list. Visible without
 *     scrolling at dashboard entry. Internal-scroll inside the rail when
 *     content exceeds the rail height.
 *   - The main column (h1, hero tiles, insight plots, WorldActivity, footer)
 *     stays in its present-tense order and absorbs the freed width.
 *   - At <1024px the grid collapses to one column; the rail stacks below
 *     the main flow.
 *
 * Per qgi-v4-1-ux-rules.md §0 and §7, and the founder's 37-comment review:
 *
 *   "Everything in the dashboard is like as if we want to give zero
 *    confidence to the user. The design has self-killing honesty.
 *    Please change this philosophy. This is too exposing, and not selling
 *    at all!"
 *
 * The replacement is a showroom, not an operations log.
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
import { TopPairsStrip } from "@/components/dashboard-v4-1/TopPairsStrip";
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
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "20px 24px 64px" }}>
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

        {/* ── Two-column shell: main scroll column + sticky right rail ─────
            Grid layout: at ≥1024px the rail holds a 320px fixed track on
            the right; the main column absorbs the rest via minmax(0, 1fr).
            Below 1024px the grid collapses to one column and the rail
            stacks under the main flow.

            The 1024px breakpoint (not 768) is intentional: at 1024 the
            usable viewport after the sidebar (224 expanded) is ~770px, so
            a 320 rail + a 450 main column is the floor where both still
            work. Below that the rail steals too much from the main column
            and the natural reading order takes over.

            We use a media-query-driven CSS Grid via the standard `grid-cols`
            pattern would require Tailwind config; instead we use an inline
            grid with `gridTemplateColumns` and a `dashboard-grid` class +
            scoped <style> so the responsive collapse happens via CSS. */}
        <style>{`
          .qgi-dashboard-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 24px;
          }
          @media (min-width: 1024px) {
            .qgi-dashboard-grid {
              grid-template-columns: minmax(0, 1fr) 320px;
              gap: 28px;
              align-items: start;
            }
          }
          .qgi-dashboard-rail {
            position: static;
          }
          @media (min-width: 1024px) {
            .qgi-dashboard-rail {
              position: sticky;
              top: 16px;
            }
          }
        `}</style>

        <div className="qgi-dashboard-grid">
          {/* ─── Main column ─────────────────────────────────────────────── */}
          <div style={{ minWidth: 0 }}>
            {/* Hero: short, sales-y h1 + one-sentence subtitle */}
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
                Every country, scored against the shapes that preceded the events that
                matter — and shown alongside the historical cases it most resembles.
              </p>
            </section>

            {/* Hero tiles: 5 catalog-size confidence metrics */}
            <section data-tour="hero-tiles">
              <DashboardHero tiles={HERO_TILES_V41(heroCounts)} />
            </section>

            {/* Insight plots: 4 audience-facing summary visuals.
                The minmax(380px,1fr) tightens the plot floor by 60px so
                two plots still fit per row inside the narrower main column
                that the new rail leaves behind on medium-wide desktops. */}
            <section
              data-tour="insight-plots"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
                gap: "0px 24px",
                marginTop: "8px",
              }}
            >
              <CoverageMapPlot data={coverage} />
              <FamilyDistributionPlot slices={familyDistrib} />
              <IndicatorCorpusPlot stats={corpus} />
              <TopPairTeaserPlot pairs={pairs} />
            </section>

            {/* World-facing activity: what's moving this vintage */}
            <section data-tour="world-activity">
              <WorldActivity rows={activity} />
            </section>

            {/* Footer — catalog scope + provenance */}
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
              {heroCounts.recipes_total} recipes across {familyDistrib.length} risk
              families · {heroCounts.indicators_tracked} signals tracked ·{" "}
              {heroCounts.countries_scored} countries scored.
            </footer>
          </div>

          {/* ─── Right rail: sticky "Top 20 today" story tape ────────────── */}
          <aside
            className="qgi-dashboard-rail"
            data-tour="top-pairs-strip"
            aria-label="Top country-recipe matches today"
            style={{ minWidth: 0 }}
          >
            <TopPairsStrip limit={20} />
          </aside>
        </div>
      </div>
    </div>
  );
}
