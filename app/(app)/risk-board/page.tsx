import type { Metadata } from "next";
import { getAllRecipes } from "@/lib/te-mock/recipes";
import { BOARD_VINTAGE, getBoardRecipes } from "@/lib/te-mock/risk-board-data";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";
import { RiskBoardHero } from "@/components/risk-board/RiskBoardHero";
import { RecentMovements } from "@/components/risk-board/RecentMovements";
import {
  RiskBoardFilters,
  type RiskBoardRecipeProjection,
} from "@/components/risk-board/RiskBoardFilters";
import { familyColor } from "@/lib/te-mock/l1-families";
import { statusLabel } from "@/lib/te-mock/country-families";

export const metadata: Metadata = {
  title: "Risk Board · QG Intelligence",
  description:
    "Present-tense, tier-gated discrimination ranks across the recipe catalog. The honest replacement for the retired Signals page.",
};

export default function RiskBoardPage() {
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
    };
  });

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
        {/* Vintage stamp (subtle) */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          <HowToReadButton routeKey="risk-board" />
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "1px",
              color: "var(--qgi-text-dim)",
              padding: "4px 8px",
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "4px",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            Data as of {BOARD_VINTAGE}
          </span>
        </div>

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
              margin: "0 0 10px",
            }}
          >
            Which countries currently resemble a validated crisis shape
          </h1>
          <p
            style={{
              color: "var(--qgi-text-muted)",
              fontSize: "15px",
              lineHeight: 1.6,
              maxWidth: "820px",
              margin: 0,
            }}
          >
            Present-tense resemblance scores from the Trajectory Engine, ranked across the
            recipe catalog. Each cell is a country&apos;s discrimination rank on a single
            recipe&apos;s canonical movement shape: read it as &quot;sits high in the
            distribution of recipe-shaped countries,&quot; not as a probability or a
            forecast. Click any cell to open the recipe&apos;s report card. This board
            makes no forward-dated claim.
          </p>
        </div>

        {/* Hero strip — today's top pairs across all recipes */}
        <RiskBoardHero vintage={BOARD_VINTAGE} />

        {/* Filter shell + grid (client component) */}
        <div style={{ marginBottom: "8px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "10px",
            }}
          >
            <div>
              <div
                style={{
                  color: "var(--qgi-accent)",
                  fontSize: "10px",
                  letterSpacing: "2.5px",
                  textTransform: "uppercase",
                  fontFamily: "ui-monospace, monospace",
                  marginBottom: "4px",
                }}
              >
                The grid
              </div>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  margin: 0,
                  color: "var(--qgi-text)",
                }}
              >
                Top-10 countries per recipe
              </h2>
            </div>
            <span
              style={{
                fontSize: "10px",
                letterSpacing: "1px",
                color: "var(--qgi-text-dim)",
                padding: "4px 8px",
                background: "var(--qgi-surface)",
                border: "1px solid var(--qgi-border)",
                borderRadius: "4px",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {boardRecipes.length} recipes on board · vintage {BOARD_VINTAGE}
            </span>
          </div>
        </div>

        <div data-tour="risk-board-grid">
          <RiskBoardFilters recipes={boardRecipes} l1Families={l1Families} />
        </div>

        {/* Recent movements panel */}
        <RecentMovements />

        {/* Footer note */}
        <footer
          style={{
            marginTop: "32px",
            padding: "16px 0",
            borderTop: "1px solid var(--qgi-border)",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.3px",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <span>
            Vintage: {BOARD_VINTAGE} · Scores refresh on each data vintage; new recipes
            appear as their evidence base grows.
          </span>
        </footer>
      </div>
    </div>
  );
}
