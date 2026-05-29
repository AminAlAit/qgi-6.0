/**
 * /patterns — Pair-strength catalogue main page.
 *
 * V4.1 quality bar:
 *   - No engine-distinction vocabulary (no cascade, Pearson, PPS, SCDI,
 *     trajectory engine, ML-2 TE, SCDI)
 *   - No statusLabel chips on pair rows (pairs are family-agnostic ranks)
 *   - No family-color borders or letter-glyphs on pair rows
 *   - Pair strength = rank 0-100, NOT a probability
 *   - Featured pair editorial = historical-voice only (no present-day activations)
 *   - NEUTRAL_SLATE for magnitude bars
 *   - HowToReadButton top-right, no inline how-to-read panel
 *   - Flags via FlagImg (flagcdn.com), never emoji
 *   - No em-dashes in copy
 *
 * Server component. Client surfaces: RankingBand, FamilyBrowsePanel,
 * CountryBrowsePanel (all "use client" with isolated state).
 */
import type { Metadata } from "next";
import {
  getPatternsCatalogue,
  getFullCatalogue,
} from "@/lib/te-mock/patterns-v4-main-data";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";
import { PageLayout } from "@/components/patterns-v4/PageLayout";
import { OverviewTiles } from "@/components/patterns-v4/OverviewTiles";
import { RankingBand } from "@/components/patterns-v4/RankingBand";
import { FamilyBrowsePanel } from "@/components/patterns-v4/FamilyBrowsePanel";
import { CountryBrowsePanel } from "@/components/patterns-v4/CountryBrowsePanel";
import { FeaturedPairPanel } from "@/components/patterns-v4/FeaturedPairPanel";
import { RecentlySurfacedPanel } from "@/components/patterns-v4/RecentlySurfacedPanel";

export const metadata: Metadata = {
  title: "Patterns · Country pair catalogue · QG Intelligence",
  description:
    "The QGI pair catalogue: country pairs whose indicator-composite histories ran in close parallel over a shared historical window, ranked by pair strength.",
};

export default function PatternsV4Page() {
  const catalogue = getPatternsCatalogue();
  const allPairs = getFullCatalogue();

  return (
    <PageLayout>
      {/* ── Top strip: HowToReadButton ── */}
      {/* V4.1 §2: vintage stamp removed — lives in the global header. */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <HowToReadButton routeKey="patterns-v4" />
      </div>

      {/* ── Section 1: Page hero ── */}
      <section aria-labelledby="patterns-v4-h1">
        <div
          style={{
            fontSize: "9px",
            letterSpacing: "2px",
            color: "var(--qgi-accent)",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "8px",
            fontWeight: 600,
          }}
        >
          PATTERNS
        </div>
        <h1
          id="patterns-v4-h1"
          style={{
            fontSize: "clamp(24px, 4vw, 38px)",
            fontWeight: 800,
            margin: "0 0 14px",
            color: "var(--qgi-text)",
            lineHeight: 1.15,
          }}
        >
          Long-run rhymes between country pairs
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "var(--qgi-text-muted)",
            maxWidth: "640px",
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          A pattern is two countries whose indicator-composite histories ran in close
          parallel over a shared multi-decade window. The catalogue ranks every pair by
          how tightly their trajectories rhymed. Pair strength is a 0-to-100 rank; it is
          not a probability of any future event.
        </p>

        {/* ── Section 2: Overview tiles (sits inside hero block) ── */}
        <OverviewTiles
          totalPairs={catalogue.total_pairs}
          medianWindowYears={catalogue.median_window_years}
          longestPair={catalogue.longest_pair}
        />
      </section>

      {/* ── Section 3: Ranking band (full-width) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr" }}>
        <RankingBand allPairs={allPairs} />
      </div>

      {/* ── Section 4: Family browse ── */}
      <FamilyBrowsePanel allPairs={allPairs} />

      {/* ── Section 5: Country browse ── */}
      <CountryBrowsePanel allPairs={allPairs} />

      {/* ── Section 6: Featured pair of the vintage ── */}
      <FeaturedPairPanel pair={catalogue.featured_pair} />

      {/* ── Section 7: Recently surfaced ── */}
      <RecentlySurfacedPanel pairs={catalogue.recently_surfaced} />

      {/* Footer */}
      {/* V4.1 §2: "{catalogue.vintage} vintage" removed from footer. */}
      <footer
        style={{
          marginTop: "48px",
          paddingTop: "20px",
          borderTop: "1px solid var(--qgi-border)",
          fontSize: "11px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.3px",
        }}
      >
        {catalogue.total_pairs} pairs · Pair strength is a rank (0-100), not a
        probability.
      </footer>
    </PageLayout>
  );
}
