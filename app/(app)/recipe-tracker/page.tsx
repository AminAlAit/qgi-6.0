import type { Metadata } from "next";
import { getAllRecipes, vintageStamp, type TrackerRecipe } from "@/lib/te-mock/recipes";
import {
  HISTORICAL_WALKS,
  IN_FLIGHT,
  QUEUED_NEXT_30D,
  VACATE_LOG,
} from "@/lib/te-mock/recipe-tracker-extra";
import { TrackerHero } from "@/components/recipe-tracker/TrackerHero";
import { WalkTimeline } from "@/components/recipe-tracker/WalkTimeline";
import { RecipeTable } from "@/components/recipe-tracker/RecipeTable";
import { InFlightPanel } from "@/components/recipe-tracker/InFlightPanel";
import { ReadThisPanel } from "@/components/recipe-tracker/ReadThisPanel";
import { VacateLog } from "@/components/recipe-tracker/VacateLog";

export const metadata: Metadata = {
  title: "Recipe Tracker · QG Intelligence",
  description:
    "Public scoreboard of the QGI recipe research program: which have been tested, deployed, or are queued. Transparent about validation states.",
  robots: { index: false, follow: false },
};

export default function RecipeTrackerPage() {
  const recipes: TrackerRecipe[] = getAllRecipes();

  // Count status straight from the source-of-truth JSON.
  // foreign_intervention is walked_no_graduation here, NOT graduated.
  const counts = recipes.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<TrackerRecipe["status"], number>
  );

  const graduated = counts.graduated ?? 0;
  const walkedFail = counts.walked_no_graduation ?? 0;
  const inProgress = counts.in_progress ?? 0;
  const legacy = counts.live_legacy ?? 0;
  const queued = counts.queued ?? 0;
  const total = recipes.length;

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "20px 24px 64px" }}>
        {/* Hero scoreboard */}
        <TrackerHero
          graduated={graduated}
          walkedFail={walkedFail}
          inProgress={inProgress + IN_FLIGHT.length}
          legacy={legacy}
          queued={queued}
          total={total}
          vintage={vintageStamp()}
        />

        {/* Validation timeline strip */}
        <WalkTimeline walks={HISTORICAL_WALKS} recipes={recipes} />

        {/* Body grid — table left, side panels right */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 320px",
            gap: "24px",
            marginTop: "28px",
          }}
        >
          {/* Left: the table */}
          <div style={{ minWidth: 0 }}>
            <RecipeTable recipes={recipes} />
          </div>

          {/* Right: side panels */}
          <aside
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              minWidth: 0,
            }}
          >
            <InFlightPanel
              inFlight={IN_FLIGHT}
              queued={QUEUED_NEXT_30D}
              recipes={recipes}
            />
            <ReadThisPanel />
            <VacateLog events={VACATE_LOG} />
          </aside>
        </div>

        {/* Footer */}
        <footer
          style={{
            marginTop: "48px",
            paddingTop: "20px",
            borderTop: "1px solid var(--qgi-border)",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            lineHeight: 1.6,
          }}
        >
          <div style={{ marginBottom: "6px", fontFamily: "ui-monospace, monospace" }}>
            Tracker vintage: {vintageStamp()} · {total} recipes across 8 L1 families ·
            Recipe-state data from <code>data/recipe-tracker.json</code> (source of
            truth).
          </div>
          <div>
            Scoreboard auto-updates after each validation pass. Illustrative historical
            validation dates, in-review items, and scheduled cards are shown for context;
            the recipe roster, statuses, and stats are real.
          </div>
        </footer>
      </div>
    </div>
  );
}
