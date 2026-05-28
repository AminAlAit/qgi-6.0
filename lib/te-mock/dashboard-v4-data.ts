import {
  GraduationCap,
  Globe,
  FlaskConical,
  Calendar,
  ChartBar,
  Layers,
  ScrollText,
  Crosshair,
  Compass,
  ListChecks,
  Radio,
  CircleX,
  FilePenLine,
  Sparkles,
  Database,
  type LucideIcon,
} from "lucide-react";

import { getAllRecipes, vintageStamp, type TrackerRecipe } from "@/lib/te-mock/recipes";
import { COMPOUND_COUNTRIES } from "@/lib/te-mock/compound-risk-data";
import { getTopPairs } from "@/lib/te-mock/risk-board-data";
import {
  HISTORICAL_WALKS,
  IN_FLIGHT,
  VACATE_LOG,
} from "@/lib/te-mock/recipe-tracker-extra";
import type { HeroTile } from "@/components/dashboard-v4/DashboardHero";
import type { Highlight } from "@/components/dashboard-v4/HighlightsBand";
import type { SurfaceCardData } from "@/components/dashboard-v4/SurfaceCard";
import type { ActivityEvent } from "@/components/dashboard-v4/ActivityTimeline";

export interface HeroCounts {
  countries: number;
  recipes_total: number;
  graduated: number;
  walked: number;
  in_flight: number;
  queued: number;
  legacy: number;
  top_compound: { country: string; score: number };
  vintage: string;
}

export function buildHeroCounts(recipes: TrackerRecipe[]): HeroCounts {
  const counts = recipes.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<TrackerRecipe["status"], number>
  );
  const top = COMPOUND_COUNTRIES.slice().sort(
    (a, b) => b.compound_score - a.compound_score
  )[0];
  return {
    countries: 174,
    recipes_total: recipes.length,
    graduated: counts.graduated ?? 0,
    walked: counts.walked_no_graduation ?? 0,
    in_flight: (counts.in_progress ?? 0) + IN_FLIGHT.length,
    queued: counts.queued ?? 0,
    legacy: counts.live_legacy ?? 0,
    top_compound: { country: top.country, score: top.compound_score },
    vintage: vintageStamp(),
  };
}

export const HERO_TILES = (c: HeroCounts): HeroTile[] => [
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
    label: "Countries on platform",
    sublabel: "Curated event records",
    Icon: Globe,
    color: "#38bdf8",
  },
  {
    value: String(c.walked + c.legacy),
    label: "Recipes tested",
    sublabel: `${c.walked} didn't hold up · ${c.legacy} early method`,
    Icon: FlaskConical,
    color: "#E68F29",
  },
  {
    value: String(c.in_flight),
    label: "In flight",
    sublabel: "Validation runs in progress",
    Icon: Radio,
    color: "#a78bfa",
  },
  {
    value: `${c.top_compound.country}`,
    label: "Top compound today",
    sublabel: `Top of the compound-risk board today. Rank ${c.top_compound.score.toFixed(1)}.`,
    Icon: Crosshair,
    color: "#E68F29",
  },
  {
    value: c.vintage,
    label: "Tracker vintage",
    sublabel: `${c.queued} queued · ${c.recipes_total} total`,
    Icon: Calendar,
    color: "#7A8FA0",
  },
];

const TOP_PAIR = getTopPairs()[0];
const TOP_COMPOUND = COMPOUND_COUNTRIES.slice().sort(
  (a, b) => b.compound_score - a.compound_score
)[0];
const LATEST_VACATE = VACATE_LOG[0];

export const HIGHLIGHTS: Highlight[] = [
  {
    source: "risk-board",
    source_label: "Risk Board",
    href: `/risk-board`,
    headline: `${TOP_PAIR.country} · Foreign Intervention`,
    caption: `Discrimination rank ${TOP_PAIR.score.toFixed(1)}; top of the board today. Rendered as deployed for the visual demo; the recipe itself is currently in review.`,
    metric: TOP_PAIR.score.toFixed(1),
    recipe_id: TOP_PAIR.recipe_id,
    tier_label: "in review",
    tier_color: "#E68F29",
  },
  {
    source: "compound-risk",
    source_label: "Compound Risk",
    href: `/compound-risk`,
    headline: `${TOP_COMPOUND.country} · ${TOP_COMPOUND.lit_recipes.length} recipes lit`,
    caption: `Heaviest single-state stack on the board: ${TOP_COMPOUND.lit_families.length} L1 families overlap (${TOP_COMPOUND.lit_families.join(", ")}). Stacking heuristic, not joint probability.`,
    metric: TOP_COMPOUND.compound_score.toFixed(1),
    icon: Crosshair,
    color: "#E68F29",
    tier_label: "compound stack",
    tier_color: "#E68F29",
  },
  {
    source: "nearest-analog",
    source_label: "Nearest Analog",
    href: "/nearest-analog",
    headline: "Egypt · resembles Algeria 1990",
    caption:
      "12-quarter composite trajectory closely matches Algeria's pre-1991 buildup. Historical fact, not a forecast about Egypt.",
    metric: "87.4",
    recipe_id: "foreign_intervention",
    tier_label: "strong match",
    tier_color: "#3FBF8F",
  },
  {
    source: "recipe-tracker",
    source_label: "Recipe Tracker",
    href: "/recipe-tracker",
    headline: `Correction: ${LATEST_VACATE.label}`,
    caption: `A prior validation didn't survive audit on ${LATEST_VACATE.vacated_at}; the recipe is back in review under a pipeline-coverage fix. Public corrections are part of how the program works.`,
    metric: "−1",
    icon: CircleX,
    color: "#E64545",
    tier_label: "correction",
    tier_color: "#E64545",
  },
];

const RECIPES = getAllRecipes();
const TOTAL_RECIPES = RECIPES.length;
const QUEUED_COUNT = RECIPES.filter((r) => r.status === "queued").length;
const WALKED_COUNT = RECIPES.filter((r) => r.status === "walked_no_graduation").length;
const LEGACY_COUNT = RECIPES.filter((r) => r.status === "live_legacy").length;

export const SURFACE_CARDS: SurfaceCardData[] = [
  {
    surface_id: "recipe-tracker",
    name: "Recipe Tracker",
    href: "/recipe-tracker",
    description:
      "Scoreboard of the whole research program: every recipe with its tier, last validation run, and verdict.",
    Icon: ListChecks,
    color: "#3FBF8F",
    metric_value: `${TOTAL_RECIPES}`,
    metric_label: "recipes tracked",
    ribbon: "new",
    chips: [
      { label: `${WALKED_COUNT} didn't hold up`, color: "#E68F29" },
      { label: `${LEGACY_COUNT} early method`, color: "#7A8FA0" },
      { label: `${QUEUED_COUNT} queued`, color: "#64748b" },
    ],
  },
  {
    surface_id: "recipes-v4-1",
    name: "Recipes",
    href: "/recipes-v4.1",
    description:
      "Per-recipe detail page: indicators selected, validation window, sample size, discrimination score, and calibration notes.",
    Icon: ScrollText,
    color: "#a78bfa",
    metric_value: "15",
    metric_label: "capabilities per recipe",
    ribbon: "evolving",
    chips: [{ label: "report-card era", color: "#a78bfa" }],
  },
  {
    surface_id: "risk-board",
    name: "Live Risk Board",
    href: "/risk-board",
    description:
      "Present-tense scoring of countries against validated crisis shapes. Bands shown. No forward call, ever.",
    Icon: ChartBar,
    color: "#E68F29",
    metric_value: "15",
    metric_label: "top pairs ranked",
    ribbon: "new",
    chips: [{ label: "validated-only by default", color: "#3FBF8F" }],
  },
  {
    surface_id: "compound-risk",
    name: "Compound Risk",
    href: "/compound-risk",
    description:
      "Which countries appear on more than one recipe at once. Stacking heuristic over discrimination ranks; not a joint probability.",
    Icon: Layers,
    color: "#E68F29",
    metric_value: String(COMPOUND_COUNTRIES.length),
    metric_label: "multi-hit countries",
    ribbon: "new",
  },
  {
    surface_id: "nearest-analog",
    name: "Nearest Analog",
    href: "/nearest-analog",
    description:
      "Which past case does this country most resemble before its event? Similarity, never forecast; carries the regional-clustering caveat.",
    Icon: Compass,
    color: "#38bdf8",
    metric_value: "3",
    metric_label: "top analogs per country",
    ribbon: "new",
  },
  {
    surface_id: "countries",
    name: "Countries",
    href: "/countries",
    description:
      "Per-country hub: scores on validated recipes, SHAP drivers, momentum, nearest analog, compound stack. The whole TE story for one place.",
    Icon: Globe,
    color: "#7B5EE6",
    metric_value: "174",
    metric_label: "country hubs",
    ribbon: "evolving",
  },
];

const RECENT_WALKS = HISTORICAL_WALKS.slice()
  .sort((a, b) => b.fired_at.localeCompare(a.fired_at))
  .slice(0, 4);

const WALK_TO_EVENT: Record<
  string,
  {
    Icon: LucideIcon;
    color: string;
    kind: ActivityEvent["kind"];
    title: (id: string, auc?: number) => string;
    detail: (id: string, auc?: number) => string;
  }
> = {
  GRADUATED: {
    Icon: GraduationCap,
    color: "#3FBF8F",
    kind: "graduation",
    title: (id) => `Validation passed: ${labelOf(id)}`,
    detail: () =>
      "Recipe cleared the discrimination threshold; later withdrawn after audit (see correction below).",
  },
  HARD_FAIL: {
    Icon: CircleX,
    color: "#E68F29",
    kind: "hard_fail",
    title: (id) => `Validation didn't hold: ${labelOf(id)}`,
    detail: () =>
      "Discrimination didn't separate pre-event from non-event years strongly enough.",
  },
  VACATED: {
    Icon: CircleX,
    color: "#E64545",
    kind: "vacate",
    title: (id) => `Correction published: ${labelOf(id)}`,
    detail: () =>
      "A prior validation was withdrawn after audit; re-evaluation is in progress.",
  },
  IN_FLIGHT: {
    Icon: Radio,
    color: "#a78bfa",
    kind: "walk_fired",
    title: (id) => `Re-evaluation in progress: ${labelOf(id)}`,
    detail: () => "Outcome will replace the prior result.",
  },
  MARGINAL: {
    Icon: Sparkles,
    color: "#a78bfa",
    kind: "walk_fired",
    title: (id) => `Validation borderline: ${labelOf(id)}`,
    detail: () => "Discrimination is near the threshold; under review.",
  },
  // SCHEDULED and QUEUED collapse to the same surface — both mean "waiting
  // for the evidence base to meet the bar before validation fires." Use a
  // single shared entry to prevent the two keys from drifting apart.
  SCHEDULED: {
    Icon: Calendar,
    color: "#7A8FA0",
    kind: "walk_fired",
    title: (id) => `Scheduled: ${labelOf(id)}`,
    detail: () => "Will run when the evidence base meets the bar.",
  },
};
// Alias QUEUED → SCHEDULED so future verdict values with either key resolve
// to the same rendering without a silent dictionary miss.
WALK_TO_EVENT.QUEUED = WALK_TO_EVENT.SCHEDULED;

function labelOf(recipe_id: string): string {
  return RECIPES.find((r) => r.recipe_id === recipe_id)?.label ?? recipe_id;
}

const WALK_EVENTS: ActivityEvent[] = RECENT_WALKS
  // Drop VACATED walk rows — the META_EVENTS entry covers this correction
  .filter((w) => w.verdict !== "VACATED")
  .map((w) => {
    const meta = WALK_TO_EVENT[w.verdict] ?? WALK_TO_EVENT.IN_FLIGHT;
    return {
      date: w.fired_at,
      kind: meta.kind,
      title: meta.title(w.recipe_id, w.loco_auc),
      detail: meta.detail(w.recipe_id, w.loco_auc),
      href: `/recipes-v4.1/${w.recipe_id}`,
      Icon: meta.Icon,
      color: meta.color,
    };
  });

const META_EVENTS: ActivityEvent[] = [
  {
    date: "2026-05-25",
    kind: "vacate",
    title: "Foreign Intervention validation withdrawn",
    detail:
      "Audit found the original result depended on a partial sample; on the full record it returns to chance. The recipe is back in review.",
    href: "/recipe-tracker",
    Icon: CircleX,
    color: "#E64545",
  },
  {
    date: "2026-05-24",
    kind: "methodology_amendment",
    title: "New checks added to validation rules",
    detail:
      "Each validation run must now report per-region data coverage and clear a baseline check before any pass or fail decision.",
    Icon: FilePenLine,
    color: "#38bdf8",
  },
  {
    date: "2026-05-22",
    kind: "indicator_added",
    title: "VC.IDP.NWDS added to the indicator catalog",
    detail:
      "World Bank's new-internal-displacements series passed quality checks; available for any recipe whose shape needs population-movement signal.",
    Icon: Database,
    color: "#3FBF8F",
  },
  {
    date: "2026-05-20",
    kind: "data_sync",
    title: "12 new verified events added to the curated set",
    detail:
      "Three Sahel-region civil-war positives plus nine other additions ratified; recipe counts refreshed.",
    Icon: Database,
    color: "#7A8FA0",
  },
  {
    date: "2026-05-17",
    kind: "methodology_amendment",
    title: "Methodology charter ratified",
    detail: "Founding-document update on how recipes are defined and scored.",
    Icon: ScrollText,
    color: "#a78bfa",
  },
];

export const ACTIVITY_EVENTS: ActivityEvent[] = [...WALK_EVENTS, ...META_EVENTS];
