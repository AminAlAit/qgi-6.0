import type { Metadata } from "next";
import { getAllRecipes, vintageStamp } from "@/lib/te-mock/recipes";
import {
  HERO_TILES_V41,
  HIGHLIGHTS,
  SURFACE_CARDS,
  ACTIVITY_EVENTS,
  buildHeroCountsV41,
} from "@/lib/te-mock/dashboard-v4-1-data";
import { DashboardHero } from "@/components/dashboard-v4-1/DashboardHero";
// Worker B — will fail tsc until Worker B lands; error is theirs, not ours.
import { HighlightsBand } from "@/components/dashboard-v4-1/HighlightsBand";
import { SurfaceGrid } from "@/components/dashboard-v4-1/SurfaceGrid";
// Worker C — same note.
import { ActivityTimeline } from "@/components/dashboard-v4-1/ActivityTimeline";
import { HowToReadButton } from "@/components/te-v4-shared/HowToReadButton";

export const metadata: Metadata = {
  title: "Dashboard · QG Intelligence",
  description:
    "QGI dashboard: pipeline state, recipe tier summary, country highlights, and recent activity.",
};

// Calm-slate-blue constant — matches CALM_SLATE_BLUE in l1-families.ts.
const CALM_SLATE_BLUE = "#5B7E99";

export default function DashboardV41Page() {
  const recipes = getAllRecipes();
  const heroCounts = buildHeroCountsV41(recipes);
  const vintage = vintageStamp();

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "20px 24px 64px" }}>
        {/* ── Top strip: HowToReadButton + vintage chip ───────────────────── */}
        {/* Mockup banner dropped 2026-05-29 — V4.1 dashboard is canonical. */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginBottom: "20px",
            gap: "10px",
          }}
        >
          <HowToReadButton routeKey="dashboard-v4.1" />
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
            Data as of {vintage}
          </span>
        </div>

        {/* ── Hero section: eyebrow + h1 + lineage + sub ──────────────────── */}
        {/* Not wrapped in a panel per Talia's call — tiles self-border already */}
        <section style={{ marginBottom: "32px" }}>
          {/* Eyebrow */}
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
            THE PLATFORM
          </div>

          {/* h1 */}
          <h1
            style={{
              fontSize: "34px",
              fontWeight: 600,
              lineHeight: 1.1,
              margin: "0 0 10px",
              maxWidth: "780px",
            }}
          >
            QG Intelligence describes country risk
            <br />
            by comparing today against history.
          </h1>

          {/* Lineage caption — calm-slate-blue, monospace, 12px */}
          <p
            style={{
              color: CALM_SLATE_BLUE,
              fontSize: "12px",
              lineHeight: 1.5,
              fontFamily: "ui-monospace, monospace",
              margin: "0 0 12px",
              maxWidth: "780px",
            }}
          >
            Out-of-sample discrimination ranks from validated recipes; every claim
            resolves to a tracker entry, every correction is published.
          </p>

          {/* Sub */}
          <p
            style={{
              color: "var(--qgi-text-muted)",
              fontSize: "14px",
              lineHeight: 1.55,
              margin: 0,
              maxWidth: "780px",
            }}
          >
            Each recipe is a pre-registered shape of indicators that we test against a
            curated record of past events. Recipes that hold up are deployed; recipes that
            do not are kept in the log so corrections stay visible. Nothing on this site
            forecasts a future event.
          </p>
        </section>

        {/* ── Hero tiles — 6 program-state metrics ────────────────────────── */}
        {/* No panel wrapper: Talia's call — tiles are self-bordered.          */}
        <section data-tour="hero-tiles">
          <DashboardHero tiles={HERO_TILES_V41(heroCounts)} />
        </section>

        {/* ── HighlightsBand (Worker B) ────────────────────────────────────── */}
        <section data-tour="highlights-band">
          <HighlightsBand highlights={HIGHLIGHTS} vintage={vintage} />
        </section>

        {/* ── SurfaceGrid (Worker B) ──────────────────────────────────────── */}
        <div data-tour="surfaces-grid">
          <SurfaceGrid cards={SURFACE_CARDS} />
        </div>

        {/* ── ActivityTimeline (Worker C) ─────────────────────────────────── */}
        <div data-tour="activity-timeline">
          <ActivityTimeline events={ACTIVITY_EVENTS} />
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
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
            Vintage {vintage} · {recipes.length} recipes across 8 L1 families · recipe
            data sourced from the public recipe tracker and platform data.
          </div>
          <div>
            Tile counts refresh after each validation run. Activity entries are
            illustrative; recipe roster, statuses, and stats are real.
          </div>
        </footer>
      </div>
    </div>
  );
}
