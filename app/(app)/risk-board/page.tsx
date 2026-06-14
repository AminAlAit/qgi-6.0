import type { Metadata } from "next";
import { getAllRecipes } from "@/lib/te-mock/recipes";
import {
  getBoardRecipes,
  getRecipeFullScoreMap,
  getRecipeRow,
} from "@/lib/te-mock/risk-board-data";
import { RecentMovements } from "@/components/risk-board/RecentMovements";
import {
  RiskBoardFilters,
  type RiskBoardRecipeProjection,
} from "@/components/risk-board/RiskBoardFilters";
import { RiskBoardViews } from "@/components/risk-board/RiskBoardViews";
import { TopicBoard } from "@/components/risk-board/TopicBoard";
import { getHfBoard } from "@/lib/hf/topics-data";
import { getLivePulse } from "@/lib/hf/live-pulse";
import { overlayCells } from "@/lib/hf/live-pulse-core";
import { LivePulseStamp } from "@/components/hf/LivePulseStamp";
import { familyColor } from "@/lib/te-mock/l1-families";
import { statusLabel } from "@/lib/te-mock/country-families";

export const metadata: Metadata = {
  title: "Risk Board · QG Intelligence",
  description:
    "Present-tense, tier-gated discrimination ranks across the trend catalog. The honest replacement for the retired Signals page.",
};

// ISR: the page is dynamic (it awaits the live pulse), so re-render it at most
// every 5 minutes — matching getLivePulse's in-process cache TTL. This keeps
// the overlay fresh without a blocking S3 read on every cold-start request.
export const revalidate = 300;

export default async function RiskBoardPage() {
  // Live overlay (Track-2): replace the monthly Topic cells with the hourly
  // news pulse wherever the live file carries a value, recomputing each
  // verdict from the same thresholds. Falls back to the monthly board when no
  // live data is present, so the page can never regress. overlayCells also
  // returns liveKeys (per-cell live markers), not surfaced in TopicBoard yet.
  const hfBoard = getHfBoard();
  const live = await getLivePulse();
  const liveBoard = { ...hfBoard, cells: overlayCells(hfBoard, live).cells };
  // The news-pulse freshness stamp (LivePulseStamp) fetches its own state
  // client-side from /api/live-pulse; it self-hides until live data exists.

  // Pull rows for the board (the curated set: scored + a representative
  // queued sample) and project to the slim public-safe shape before passing
  // to the client. Raw verdict/stats/status enum are stripped server-side.
  const boardRecipes: RiskBoardRecipeProjection[] = getBoardRecipes().map((r) => {
    const sl = statusLabel(r.status);
    return {
      recipe_id: r.recipe_id,
      label: r.label,
      l1_id: r.l1_id,
      l1_label: r.l1_label,
      l1_color: r.l1_color,
      l2_label: r.l2_label,
      statusLabel: sl.label,
      statusTone: sl.tone,
      // Round-3.5 (2026-05-29): full country→score map per recipe drives
      // the multi-country custom-grid mode. Cascade recipes contribute
      // ~10 entries; TE sample-10 recipes ~150; queued recipes 0.
      // Total payload across the board is ~1.5k entries, manageable as
      // an inline server→client prop.
      scoreByCountry: getRecipeFullScoreMap(r.recipe_id),
    };
  });

  // Aggregate every known country across every visible row — the universe
  // the user can multi-select from. Sorted alphabetically; dedup'd.
  const countryUniverse = (() => {
    const set = new Set<string>();
    for (const recipe of boardRecipes) {
      for (const name of Object.keys(recipe.scoreByCountry)) {
        set.add(name);
      }
    }
    // Also include the top-10 country names from queued recipes' projections
    // when available so the picker doesn't surprise-omit anyone we've ever
    // shown on the board.
    for (const recipe of boardRecipes) {
      const row = getRecipeRow(recipe.recipe_id);
      if (row) for (const c of row.cells) if (c.country !== "—") set.add(c.country);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  })();

  // Build L1 family meta from the full recipe list so a filter chip exists
  // for every family — even if a family has only queued recipes today.
  // Run each entry through familyColor() so F-family gets its corrected hue.
  const l1Map = new Map<string, { id: string; label: string; color: string }>();
  for (const r of getAllRecipes()) {
    if (!l1Map.has(r.l1_id)) {
      l1Map.set(r.l1_id, {
        id: r.l1_id,
        label: r.l1_label,
        color: familyColor(r.l1_id, r.l1_color),
      });
    }
  }
  const l1Families = Array.from(l1Map.values()).sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: "24px" }}>
        {/* 2026-05-30 — "How to read this page" button removed from Risk
            Board. The new h1 + subtitle ('Where today's country paths
            resemble…' + 3-sentence teaching subtitle) carry the reading
            guidance inline; the popover was redundant. The button stays
            on other surfaces (recipes detail, country detail) where the
            methodology depth still warrants it. */}

        {/* Page hero */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              color: "var(--qgi-accent)",
              fontSize: "10px",
              letterSpacing: "4px",
              textTransform: "uppercase",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "8px",
            }}
          >
            Risk Board
          </div>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 600,
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Where today&apos;s country paths resemble history&apos;s event trends
          </h1>
          {/* HF merge review (2026-06-10): the descriptive paragraph moved
              INTO each tab view so the visible explanation always matches
              the visible grid (the old static copy described trend rows
              while the Topics tab shows country rows). One h1 + one
              tab-appropriate sentence, per V4.1 §5. */}
        </div>

        {/* "Today across the catalog" hero strip removed 2026-05-29 —
            moved to /dashboard in a slim form (TopPairsStrip). The grid
            below is the primary surface here; the dashboard owns the
            teaser. */}

        {/* Filter shell + grid (client component) */}
        {/* "The grid" eyebrow + "Top-10 countries per recipe" h2 removed
            2026-05-30 — redundant with the filter bar that immediately
            announces what this surface is. The grid stands on its own. */}

        {/* HF merge step 1 (2026-06-10): the board now carries two views.
            Trends = the structural grid (unchanged, below). News Topics =
            the news-layer verdict board (TopicBoard). Both render
            server-side and stay mounted; RiskBoardViews only toggles
            visibility, so filter/lens state survives tab flips. */}
        <RiskBoardViews
          trends={
            <>
              <p
                style={{
                  color: "var(--qgi-text-muted)",
                  fontSize: "15px",
                  lineHeight: 1.6,
                  maxWidth: "820px",
                  margin: "0 0 16px",
                }}
              >
                {/* 2026-05-30 polish: dropped "discrimination ranks" jargon and
                    the "Not a forecast" hedge. No em-dashes per V4.1 §11. */}
                Each row is an event trend, a shape reconstructed from past cases. Each
                cell shows how closely a country&apos;s recent path matches that shape.
                Scan a row for today&apos;s closest matches, or pick countries to compare
                them across the catalog.
              </p>
              <div data-tour="risk-board-grid">
                <RiskBoardFilters
                  recipes={boardRecipes}
                  l1Families={l1Families}
                  countryUniverse={countryUniverse}
                />
              </div>
              {/* Recent movements panel (structural, vintage-over-vintage) */}
              <RecentMovements />
              {/* Trends-tab footer (cadence copy is per-view; the Topics view
                  carries its own). */}
              <footer
                style={{
                  marginTop: "32px",
                  padding: "16px 0",
                  borderTop: "1px solid var(--qgi-border)",
                  fontSize: "11px",
                  color: "var(--qgi-text-dim)",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.3px",
                }}
              >
                Scores refresh on each data release. New trends appear as their evidence
                base grows.
              </footer>
            </>
          }
          topics={
            <>
              {/* Self-fetching client stamp; renders nothing until live data
                  arrives, so no empty space is reserved. */}
              <div style={{ margin: "0 0 12px" }}>
                <LivePulseStamp />
              </div>
              <TopicBoard data={liveBoard} />
            </>
          }
        />

        {/* V4.1 §2: "Vintage: {BOARD_VINTAGE}" removed from footer.
            2026-06-10: the cadence footer moved inside the Trends tab node
            so the Topics view doesn't stack two footers. */}
      </div>
    </div>
  );
}
