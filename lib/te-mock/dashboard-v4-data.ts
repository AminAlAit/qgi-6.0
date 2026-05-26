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
      c.graduated === 0 ? "0 today — see the vacate log" : "Cleared every pre-reg gate",
    Icon: GraduationCap,
    color: "#3FBF8F",
  },
  {
    value: String(c.countries),
    label: "Countries on platform",
    sublabel: "Verified-positive corpus",
    Icon: Globe,
    color: "#38bdf8",
  },
  {
    value: String(c.walked + c.legacy),
    label: "Recipes walked",
    sublabel: `${c.walked} walked-failed · ${c.legacy} legacy`,
    Icon: FlaskConical,
    color: "#E68F29",
  },
  {
    value: String(c.in_flight),
    label: "In flight",
    sublabel: "Walks running now",
    Icon: Radio,
    color: "#a78bfa",
  },
  {
    value: `${c.top_compound.country}`,
    label: "Top compound today",
    sublabel: `Compound rank ${c.top_compound.score.toFixed(1)}`,
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
    href: `/risk-board#${TOP_PAIR.recipe_id}`,
    headline: `${TOP_PAIR.country} · Foreign Intervention`,
    caption: `Discrimination rank ${TOP_PAIR.score.toFixed(1)} — top of the validated-recipe board today. Demo-graduated rendering; real status is walked-not-graduated pending re-walk.`,
    metric: TOP_PAIR.score.toFixed(1),
    recipe_id: TOP_PAIR.recipe_id,
    tier_label: "demo · graduated",
    tier_color: "#3FBF8F",
  },
  {
    source: "compound-risk",
    source_label: "Compound Risk",
    href: `/compound-risk#${TOP_COMPOUND.iso}`,
    headline: `${TOP_COMPOUND.country} · ${TOP_COMPOUND.lit_recipes.length} recipes lit`,
    caption: `Heaviest single-state stack on the board — ${TOP_COMPOUND.lit_families.length} L1 families overlap (${TOP_COMPOUND.lit_families.join(", ")}). Stacking heuristic, not joint probability.`,
    metric: TOP_COMPOUND.compound_score.toFixed(1),
    icon: Crosshair,
    color: "#E68F29",
    tier_label: "compound stack",
    tier_color: "#E68F29",
  },
  {
    source: "nearest-analog",
    source_label: "Nearest Analog",
    href: "/nearest-analog#egypt",
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
    headline: `Vacated: ${LATEST_VACATE.label}`,
    caption: `${LATEST_VACATE.cause} · ${LATEST_VACATE.vacated_at}. Public retraction; re-walk in flight. This is what the honesty regime looks like in motion.`,
    metric: "−1",
    icon: CircleX,
    color: "#E64545",
    tier_label: "vacated",
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
      "Scoreboard of the whole research program — every recipe with its tier, last walk, and verdict. The spine of QGI's honesty regime.",
    Icon: ListChecks,
    color: "#3FBF8F",
    metric_value: `${TOTAL_RECIPES}`,
    metric_label: "recipes tracked",
    ribbon: "new",
    chips: [
      { label: `${WALKED_COUNT} walked-failed`, color: "#E68F29" },
      { label: `${LEGACY_COUNT} legacy`, color: "#7A8FA0" },
      { label: `${QUEUED_COUNT} queued`, color: "#64748b" },
    ],
  },
  {
    surface_id: "precedents-v2",
    name: "Recipes",
    href: "/precedents-v2",
    description:
      "Per-recipe report card — the 15-capability anatomy: indicators, window, sample sufficiency, discrimination, calibration disclosure.",
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
      "Present-tense scoring of countries against validated crisis shapes. Bands shown. No forward call, ever. The honest replacement for Signals.",
    Icon: ChartBar,
    color: "#E68F29",
    metric_value: "10×N",
    metric_label: "country × recipe heatmap",
    ribbon: "new",
    chips: [{ label: "validated-only by default", color: "#3FBF8F" }],
  },
  {
    surface_id: "compound-risk",
    name: "Compound Risk",
    href: "/compound-risk",
    description:
      "Which countries light up on more than one recipe at once. Transparent stacking heuristic over discrimination ranks — not a joint probability.",
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
      "Which past case does this country most resemble before its event? Similarity, never forecast — carries the regional-clustering caveat.",
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
      "Per-country hub: scores on validated recipes, SHAP drivers, momentum, nearest analog, compound stack — the whole TE story for one place.",
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
    title: (id) => `Walk graduated: ${labelOf(id)}`,
    detail: (id, auc) =>
      `LOCO-AUC ${auc?.toFixed(4) ?? "—"} cleared the LOCK floor. Subsequently vacated — see entry below.`,
  },
  HARD_FAIL: {
    Icon: CircleX,
    color: "#E68F29",
    kind: "hard_fail",
    title: (id) => `Walk hard-failed: ${labelOf(id)}`,
    detail: (id, auc) =>
      `LOCO-AUC ${auc?.toFixed(4) ?? "—"} below the LOCK floor. Hard-core mechanic validated; protective-belt threshold did not clear.`,
  },
  VACATED: {
    Icon: CircleX,
    color: "#E64545",
    kind: "vacate",
    title: (id) => `Graduation vacated: ${labelOf(id)}`,
    detail: () =>
      "Sample-truncation leak found in F-ML-1. Public retraction; fan-out held; re-walk under pipeline-coverage fix.",
  },
  IN_FLIGHT: {
    Icon: Radio,
    color: "#a78bfa",
    kind: "walk_fired",
    title: (id) => `Walk fired: ${labelOf(id)}`,
    detail: () =>
      "Re-walk under the pipeline-coverage fix. ETA ~5–6h. Outcome will replace the prior verdict.",
  },
  MARGINAL: {
    Icon: Sparkles,
    color: "#a78bfa",
    kind: "walk_fired",
    title: (id) => `Walk completed: ${labelOf(id)}`,
    detail: (id, auc) =>
      `Marginal verdict at LOCO-AUC ${auc?.toFixed(4) ?? "—"}; awaiting Majles review.`,
  },
};

function labelOf(recipe_id: string): string {
  return RECIPES.find((r) => r.recipe_id === recipe_id)?.label ?? recipe_id;
}

const WALK_EVENTS: ActivityEvent[] = RECENT_WALKS.map((w) => {
  const meta = WALK_TO_EVENT[w.verdict] ?? WALK_TO_EVENT.IN_FLIGHT;
  return {
    date: w.fired_at,
    kind: meta.kind,
    title: meta.title(w.recipe_id, w.loco_auc),
    detail: meta.detail(w.recipe_id, w.loco_auc),
    href: `/precedents-v2/${w.recipe_id}`,
    Icon: meta.Icon,
    color: meta.color,
  };
});

const META_EVENTS: ActivityEvent[] = [
  {
    date: "2026-05-25",
    kind: "vacate",
    title: "Foreign Intervention graduation publicly vacated",
    detail:
      "Sample-truncation leak in F-ML-1 §4.2 reduced the published 0.9147 to ≈0.50 on full history. North Star paragraph stays in correction mode until re-walk completes.",
    href: "/recipe-tracker",
    Icon: CircleX,
    color: "#E64545",
  },
  {
    date: "2026-05-24",
    kind: "methodology_amendment",
    title: "Cohort coverage + chance gates added to F-ML-1",
    detail:
      "Pre-registration amendment (qgi-docs#130) — every walk must now report per-cohort coverage AND clear the chance floor before any LOCK gate is evaluated.",
    Icon: FilePenLine,
    color: "#38bdf8",
  },
  {
    date: "2026-05-22",
    kind: "indicator_added",
    title: "VC.IDP.NWDS added to the indicator catalog",
    detail:
      "World Bank new-internal-displacements series passed Ihsa stationarity audit; now available for any recipe whose canonical shape needs population-movement signal.",
    Icon: Database,
    color: "#3FBF8F",
  },
  {
    date: "2026-05-20",
    kind: "data_sync",
    title: "Curated-events sync · 12 new verified events",
    detail:
      "Three Sahel-region civil_war_and_insurgency positives + nine miscellaneous additions ratified into qgi-data/events/curated/. Recipe N_pos counts updated.",
    Icon: Database,
    color: "#7A8FA0",
  },
  {
    date: "2026-05-17",
    kind: "methodology_amendment",
    title: "Methodology Charter ratified",
    detail:
      "Saudi-Azeri canonical example + 5-component recipe definition + cascade-vs-ML synthesis. Every R&D decision now traces to qgi-docs/internal/methodology-charter.md.",
    Icon: ScrollText,
    color: "#a78bfa",
  },
];

export const ACTIVITY_EVENTS: ActivityEvent[] = [...WALK_EVENTS, ...META_EVENTS];
