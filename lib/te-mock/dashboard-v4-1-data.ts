/**
 * Data layer for /dashboard
 *
 * - HERO_TILES_V41 — 6 revised tiles per the V4.1 spec (spec date 2026-05-28).
 *   Splits V4's combined "Recipes tested" tile into two separate tiles
 *   (walked/not-graduated + live-legacy), removes the compound-risk country
 *   tile, renames "Countries on platform".
 *
 * - buildHeroCountsV41 — same shape as V4's buildHeroCounts; exported
 *   separately so page.tsx can call it without importing from dashboard-v4-data.
 *
 * - Re-exports HIGHLIGHTS, SURFACE_CARDS, ACTIVITY_EVENTS from
 *   dashboard-v4-data unchanged; Worker B (HighlightsBand, SurfaceGrid) and
 *   Worker C (ActivityTimeline) will consume them via their own new components.
 *
 * NOT production data. Local mockup only.
 */

import {
  GraduationCap,
  Globe,
  FlaskConical,
  ScrollText,
  Radio,
  Calendar,
} from "lucide-react";

import { getAllRecipes, vintageStamp, type TrackerRecipe } from "@/lib/te-mock/recipes";
import { IN_FLIGHT } from "@/lib/te-mock/recipe-tracker-extra";
import type { HeroTile } from "@/components/dashboard-v4-1/DashboardHero";

// Re-export V4 data shapes for the V4.1 page. HIGHLIGHTS and ACTIVITY_EVENTS
// flow through unchanged; SURFACE_CARDS gets the V4.1 trim (ribbon stripped,
// UI-architectural metrics cleared on the 3 affected cards).
import {
  HIGHLIGHTS,
  SURFACE_CARDS as _SURFACE_CARDS_V4,
  ACTIVITY_EVENTS,
} from "@/lib/te-mock/dashboard-v4-data";
import { toV41SurfaceCardData } from "@/components/dashboard-v4-1/SurfaceCard";

export { HIGHLIGHTS, ACTIVITY_EVENTS };
export const SURFACE_CARDS = _SURFACE_CARDS_V4.map(toV41SurfaceCardData);

// ─── Hero counts ────────────────────────────────────────────────────────────

export interface HeroCounts41 {
  countries: number;
  recipes_total: number;
  graduated: number;
  walked: number;
  in_flight: number;
  queued: number;
  legacy: number;
  vintage: string;
}

export function buildHeroCountsV41(recipes: TrackerRecipe[]): HeroCounts41 {
  const counts = recipes.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<TrackerRecipe["status"], number>
  );
  return {
    countries: 174,
    recipes_total: recipes.length,
    graduated: counts.graduated ?? 0,
    walked: counts.walked_no_graduation ?? 0,
    in_flight: (counts.in_progress ?? 0) + IN_FLIGHT.length,
    queued: counts.queued ?? 0,
    legacy: counts.live_legacy ?? 0,
    vintage: vintageStamp(),
  };
}

// ─── Hero tiles ─────────────────────────────────────────────────────────────

/**
 * V4.1 hero tiles — 6 slots per spec:
 *
 * 1. Validated recipes           (graduated, green, big)
 * 2. Countries with event coverage (countries, sky-blue)
 * 3. Tested, did not hold up     (walked_no_graduation, orange)
 * 4. Early method, under review  (live_legacy, neutral-slate)
 * 5. In flight                   (in_progress + IN_FLIGHT, purple)
 * 6. Tracker vintage             (slate)
 *
 * Removed from V4: "Top compound today" — compound score is an unbounded
 * stacking heuristic and a country name in a headline metric slot reads as a
 * forecast signal. It appears correctly framed inside HighlightsBand.
 */
export const HERO_TILES_V41 = (c: HeroCounts41): HeroTile[] => [
  {
    big: true,
    value: String(c.graduated),
    label: "Validated recipes",
    sublabel:
      c.graduated === 0
        ? "0 today. See the correction log below."
        : "Cleared every pre-registered check",
    Icon: GraduationCap,
    color: "#3FBF8F",
  },
  {
    value: String(c.countries),
    label: "Countries with curated event coverage",
    sublabel: "Curated event records",
    Icon: Globe,
    color: "#38bdf8",
  },
  {
    value: String(c.walked),
    label: "Tested, did not hold up",
    sublabel: "Validation runs that did not clear the bar",
    Icon: FlaskConical,
    color: "#E68F29",
  },
  {
    value: String(c.legacy),
    label: "Early method, under review",
    sublabel: "Pre-cascade recipes pending re-evaluation",
    Icon: ScrollText,
    color: "#7A8FA0",
  },
  {
    value: String(c.in_flight),
    label: "In flight",
    sublabel: "Validation runs in progress",
    Icon: Radio,
    color: "#a78bfa",
  },
  {
    value: c.vintage,
    label: "Tracker vintage",
    sublabel: `${c.queued} queued · ${c.recipes_total} total`,
    Icon: Calendar,
    color: "#7A8FA0",
  },
];

// Convenience: pre-built tiles from the live recipe list.
// Page can call this directly rather than building counts separately.
export function getHeroTilesV41(): HeroTile[] {
  const recipes = getAllRecipes();
  return HERO_TILES_V41(buildHeroCountsV41(recipes));
}
