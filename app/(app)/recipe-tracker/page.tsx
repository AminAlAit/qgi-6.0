import type { Metadata } from "next";
import { getAllRecipes, getRecipe, type TrackerRecipe } from "@/lib/te-mock/recipes";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";
import {
  HISTORICAL_WALKS,
  IN_FLIGHT,
  QUEUED_NEXT_30D,
  VACATE_LOG,
} from "@/lib/te-mock/recipe-tracker-extra";
import { TrackerHero } from "@/components/recipe-tracker/TrackerHero";
import { RecipeTable } from "@/components/recipe-tracker/RecipeTable";
import { AuditTrailSection } from "@/components/recipe-tracker/AuditTrailSection";

export const metadata: Metadata = {
  title: "Recipe Tracker · QG Intelligence",
  description:
    "The QGI recipe catalog: every recipe, its validation status, and its report card.",
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

  // IN_FLIGHT items already exist in the JSON under their canonical status
  // (walked_no_graduation or live_legacy). Subtract them from those buckets
  // before adding them to inProgress, so the five tiles still sum to total.
  const inFlightIds = new Set(IN_FLIGHT.map((x) => x.recipe_id));
  let walkedFail = counts.walked_no_graduation ?? 0;
  let legacy = counts.live_legacy ?? 0;
  for (const id of inFlightIds) {
    const r = getRecipe(id);
    if (r?.status === "walked_no_graduation") walkedFail--;
    else if (r?.status === "live_legacy") legacy--;
  }
  // Debug assertion: graduated + walkedFail + inProgress + legacy + queued === total
  const graduated = counts.graduated ?? 0;
  const inProgress = (counts.in_progress ?? 0) + IN_FLIGHT.length;
  const queued = counts.queued ?? 0;
  const total = recipes.length;
  // Assert: 0 + walkedFail + inProgress + legacy + queued should equal total (71)

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1320px", margin: "0 auto", padding: "20px 24px 64px" }}>
        {/* Top strip: HowToReadButton right-aligned */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "12px",
          }}
        >
          <HowToReadButton routeKey="recipe-tracker" />
        </div>

        {/* Hero scoreboard */}
        <TrackerHero
          graduated={graduated}
          walkedFail={walkedFail}
          inProgress={inProgress}
          legacy={legacy}
          queued={queued}
          total={total}
        />

        {/* Main table (always visible — confidence-first surface) */}
        <div style={{ marginTop: "28px" }}>
          <RecipeTable recipes={recipes} />
        </div>

        {/* Methodology audit trail — collapsed by default per V4.1 §0.
            Audience-curious users click in; default visitor sees the catalog. */}
        <AuditTrailSection
          walks={HISTORICAL_WALKS}
          inFlight={IN_FLIGHT}
          queued={QUEUED_NEXT_30D}
          vacateLog={VACATE_LOG}
          recipes={recipes}
        />

        {/* Footer — V4.1 §2: no vintage stamp, no L1 family count */}
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
          <div style={{ fontFamily: "ui-monospace, monospace" }}>
            {total} recipes across 8 categories · Recipe status from{" "}
            <code>data/recipe-tracker.json</code> · Refreshes after each validation pass.
          </div>
        </footer>
      </div>
    </div>
  );
}
