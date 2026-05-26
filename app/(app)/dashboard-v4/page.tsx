import type { Metadata } from "next";
import { getAllRecipes, vintageStamp } from "@/lib/te-mock/recipes";
import {
  HERO_TILES,
  HIGHLIGHTS,
  SURFACE_CARDS,
  ACTIVITY_EVENTS,
  buildHeroCounts,
} from "@/lib/te-mock/dashboard-v4-data";
import { DashboardHero } from "@/components/dashboard-v4/DashboardHero";
import { HighlightsBand } from "@/components/dashboard-v4/HighlightsBand";
import { SurfaceGrid } from "@/components/dashboard-v4/SurfaceGrid";
import { ActivityTimeline } from "@/components/dashboard-v4/ActivityTimeline";
import { StructuralFenceNote } from "@/components/dashboard-v4/StructuralFenceNote";

export const metadata: Metadata = {
  title: "Dashboard v4 (mockup) · QG Intelligence",
  description:
    "Command-center landing in the V4 idiom — a tier-stamped sampler of every QGI surface. Local-only mockup; not for production.",
  robots: { index: false, follow: false },
};

export default function DashboardV4Page() {
  const recipes = getAllRecipes();
  const heroCounts = buildHeroCounts(recipes);
  const vintage = vintageStamp();

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "20px 24px 64px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "5px 12px",
              border: "1px solid var(--qgi-accent)",
              color: "var(--qgi-accent)",
              borderRadius: "4px",
              fontSize: "11px",
              letterSpacing: "1.5px",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            MOCKUP · /dashboard-v4 · local only
          </span>
          <span
            style={{
              fontSize: "10px",
              letterSpacing: "1px",
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-text-dim)",
              padding: "5px 10px",
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "4px",
            }}
          >
            Data as of {vintage} · M8-R5 honesty regime
          </span>
        </div>

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
          Command center
        </div>
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            marginBottom: "24px",
          }}
        >
          <div style={{ maxWidth: "780px" }}>
            <h1
              style={{
                fontSize: "34px",
                fontWeight: 600,
                lineHeight: 1.1,
                margin: "0 0 10px",
              }}
            >
              QG Intelligence at a glance
            </h1>
            <p
              style={{
                color: "var(--qgi-text-muted)",
                fontSize: "14px",
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              A 30-second sampler of every surface in the platform. Counts and ranks come
              from the source-of-truth recipe-tracker; nothing on this page upgrades a
              tier or makes a forward call. Open any tile to drop into the deep page.
            </p>
          </div>
        </div>

        <DashboardHero tiles={HERO_TILES(heroCounts)} />
        <HighlightsBand highlights={HIGHLIGHTS} vintage={vintage} />
        <SurfaceGrid cards={SURFACE_CARDS} />
        <ActivityTimeline events={ACTIVITY_EVENTS} />
        <StructuralFenceNote />

        <footer
          style={{
            marginTop: "48px",
            paddingTop: "20px",
            borderTop: "1px solid var(--qgi-border)",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            lineHeight: 1.6,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <div style={{ marginBottom: "4px" }}>
            Dashboard v4 mockup · vintage {vintage} · {recipes.length} recipes across 8 L1
            families · data from <code>data/recipe-tracker.json</code> +{" "}
            <code>lib/te-mock/*</code>.
          </div>
          <div>
            Tile counts are recomputed every walk. Activity entries are illustrative;
            recipe roster, statuses, and stats are real.
          </div>
        </footer>
      </div>
    </div>
  );
}
