/**
 * Mock data for the /risk-board page — the "honest replacement for Signals."
 *
 * Three feeds:
 *   1. getTopPairs()        — today's top {country × recipe} pairs, ranked.
 *   2. getRecipeRow(id)     — for a recipe row, the top-10 country/score cells.
 *   3. getRecentMovements() — recent rank shifts across the board.
 *
 * All numbers are MOCK / illustrative. Per the M8-R5 honesty regime, scores
 * are presented as DISCRIMINATION RANKS, not probabilities.
 *
 * State alignment with recipe-tracker.json (vintage 2026-05-23):
 *   - foreign_intervention            → walked_no_graduation (rendered as
 *                                         demo-graduated for the mockup;
 *                                         see lib/te-mock/recipes.ts).
 *   - civil_war_and_insurgency        → live_legacy (F-ML-1 HARD_FAIL chip).
 *   - terrorist_attack                → walked_no_graduation (HARD-FAIL).
 *   - economic_recession              → walked_no_graduation (HARD-FAIL).
 *   - elections_and_voting            → walked_no_graduation (HARD-FAIL).
 *   - everything else                 → queued / no-walk.
 */

import { getAllRecipes, getRecipe, type TrackerRecipe } from "@/lib/te-mock/recipes";

export const BOARD_VINTAGE = "2026-05-23";

/* ────────────────────────────────────────────────────────────────────────── */
/* Types                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export interface BoardPair {
  country: string;
  recipe_id: string;
  score: number;
  /**
   * Rank-shift vs the prior bake vintage (quarterly cadence per R&D reply
   * §Q3, qgi-docs #169). Negative = moved up (lower rank #). NULL at
   * vintage 1 — no prior vintage to diff against.
   */
  rank_delta_q: number | null;
}

/**
 * Cell-state honesty (R&D reply qgi-docs #169 §Q7):
 *   - "scored"        — country has indicator coverage AND a walk has run.
 *   - "not_scored"    — country lacks coverage for this recipe's indicators;
 *                       NEVER framed as "low score" (different thing).
 *   - "no_walk_yet"   — the recipe itself is queued; no scores exist for
 *                       anyone yet.
 */
export type CellState = "scored" | "not_scored" | "no_walk_yet";

export interface BoardCell {
  country: string;
  /**
   * Discrimination rank, 0–100. Per M8-R5 NOT a probability.
   * `null` when state ≠ "scored".
   */
  score: number | null;
  /**
   * Honesty contract per R&D reply §Q7. A country missing coverage for a
   * recipe is "not_scored," never rendered as a low score.
   */
  state: CellState;
}

export interface RecipeRow {
  recipe_id: string;
  cells: BoardCell[];
  /** "graduated" | "walked_no_graduation" | "live_legacy" | "queued". */
  display_state: "graduated" | "walked_no_graduation" | "live_legacy" | "queued";
  /**
   * R&D reply §Q7 — per-recipe country coverage. n_countries_scored is the
   * count of countries with sufficient indicator coverage for THIS recipe.
   * countries_not_scored_iso lists the platform-roster countries without
   * coverage (for honesty surfacing in the row footer).
   *
   * Both null on `no_walk_yet` rows.
   */
  n_countries_scored: number | null;
  countries_not_scored_iso: string[] | null;
  /**
   * Total platform-roster size at the current vintage — denominator for
   * the coverage caption ("X of Y platform countries scored").
   */
  platform_roster_size: number;
}

export interface RankMovement {
  country: string;
  recipe_id: string;
  prior_rank: number;
  new_rank: number;
  /**
   * Number of bake vintages back the prior reading is from. ≥1 (quarterly
   * cadence per R&D reply §Q3). At vintage 1, the entire feed is empty —
   * the frontend renders <HistoryAccumulatingGate /> instead.
   */
  delta_quarters: number;
  /**
   * The vintage tag of the prior reading — e.g. "2026-Q2". Lets the UI
   * render "since 2026-Q2" verbatim, more honest than a relative count.
   */
  vs_vintage: string;
  /** A one-line hint why the rank shifted. Illustrative — not causal. */
  blurb: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* TOP PAIRS — today's headline strip                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The hero "today's top 10 across the catalog" list. Pairs are drawn ONLY
 * from recipes that have a real-looking score surface (demo-graduated +
 * walked recipes). Queued recipes contribute nothing to this list.
 */
const TOP_PAIRS_RAW: BoardPair[] = [
  { country: "Iran", recipe_id: "foreign_intervention", score: 98.1, rank_delta_q: 0 },
  {
    country: "Turkmenistan",
    recipe_id: "foreign_intervention",
    score: 97.0,
    rank_delta_q: 1,
  },
  {
    country: "Equatorial Guinea",
    recipe_id: "foreign_intervention",
    score: 96.9,
    rank_delta_q: -1,
  },
  { country: "Belarus", recipe_id: "foreign_intervention", score: 94.2, rank_delta_q: 0 },
  {
    country: "Tajikistan",
    recipe_id: "foreign_intervention",
    score: 88.5,
    rank_delta_q: 2,
  },
  {
    country: "Myanmar",
    recipe_id: "civil_war_and_insurgency",
    score: 77.8,
    rank_delta_q: 0,
  },
  {
    country: "Yemen",
    recipe_id: "civil_war_and_insurgency",
    score: 74.5,
    rank_delta_q: 0,
  },
  { country: "Pakistan", recipe_id: "terrorist_attack", score: 71.5, rank_delta_q: 1 },
  {
    country: "Sudan",
    recipe_id: "civil_war_and_insurgency",
    score: 71.2,
    rank_delta_q: -2,
  },
  { country: "Argentina", recipe_id: "economic_recession", score: 72.1, rank_delta_q: 3 },
  { country: "Tunisia", recipe_id: "elections_and_voting", score: 71.2, rank_delta_q: 0 },
  { country: "Turkey", recipe_id: "economic_recession", score: 68.5, rank_delta_q: -1 },
  { country: "DRC", recipe_id: "civil_war_and_insurgency", score: 68.4, rank_delta_q: 0 },
  { country: "Iraq", recipe_id: "terrorist_attack", score: 67.8, rank_delta_q: 0 },
  { country: "Lebanon", recipe_id: "economic_recession", score: 65.4, rank_delta_q: 2 },
];

export function getTopPairs(): BoardPair[] {
  return TOP_PAIRS_RAW.slice().sort((a, b) => b.score - a.score);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* PER-RECIPE ROWS — the heatmap grid                                          */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Builds a `BoardCell` with the right state. Convenience constructor used
 * inline below.
 */
const scored = (country: string, score: number): BoardCell => ({
  country,
  score,
  state: "scored",
});

const RECIPE_ROW_CELLS: Record<string, BoardCell[]> = {
  foreign_intervention: [
    scored("Iran", 98.1),
    scored("Turkmenistan", 97.0),
    scored("Equatorial Guinea", 96.9),
    scored("Belarus", 94.2),
    scored("Tajikistan", 88.5),
    scored("Eritrea", 84.1),
    scored("Venezuela", 81.7),
    scored("Cuba", 78.9),
    scored("Nicaragua", 75.6),
    scored("Syria", 73.4),
  ],
  civil_war_and_insurgency: [
    scored("Myanmar", 77.8),
    scored("Yemen", 74.5),
    scored("Sudan", 71.2),
    scored("DRC", 68.4),
    scored("Mali", 64.5),
    scored("Ethiopia", 61.8),
    scored("Somalia", 60.1),
    scored("Burkina Faso", 58.7),
    scored("CAR", 56.4),
    scored("Niger", 54.2),
  ],
  terrorist_attack: [
    scored("Pakistan", 71.5),
    scored("Iraq", 67.8),
    scored("Mali", 64.2),
    scored("Burkina Faso", 61.0),
    scored("Nigeria", 58.5),
    scored("Somalia", 55.8),
    scored("Afghanistan", 54.1),
    scored("Mozambique", 51.4),
    scored("Niger", 49.7),
    scored("Cameroon", 47.2),
  ],
  economic_recession: [
    scored("Argentina", 72.1),
    scored("Turkey", 68.5),
    scored("Lebanon", 65.4),
    scored("Sri Lanka", 61.8),
    scored("Pakistan", 58.2),
    scored("Egypt", 55.7),
    scored("Ghana", 53.1),
    scored("Zambia", 50.8),
    scored("Tunisia", 48.4),
    scored("Ecuador", 46.0),
  ],
  elections_and_voting: [
    scored("Tunisia", 71.2),
    scored("Senegal", 68.4),
    scored("Brazil", 64.8),
    scored("South Africa", 62.5),
    scored("Indonesia", 58.7),
    scored("Mexico", 56.1),
    scored("Philippines", 53.5),
    scored("Poland", 51.2),
    scored("India", 49.4),
    scored("Turkey", 47.0),
  ],
};

/**
 * Per R&D reply §Q7: n_countries_scored varies per recipe based on which
 * countries have coverage for that recipe's selected indicators.
 * Platform roster ≈174 at current vintage; coverage is recipe-specific.
 *
 * Illustrative values per the cohort-coverage amendment (qgi-docs#130).
 */
const PLATFORM_ROSTER_SIZE = 174;

const RECIPE_COVERAGE: Record<string, { n_scored: number; not_scored_iso: string[] }> = {
  // Foreign intervention uses RQ.EST + v2pepwrgen + v2stfisccap + v2elintmon —
  // V-Dem coverage gap on a handful of microstates.
  foreign_intervention: {
    n_scored: 167,
    not_scored_iso: ["AND", "MCO", "SMR", "TUV", "NRU", "PLW", "MHL"],
  },
  // Civil war uses VC.BTL.DETH which has small-state gaps.
  civil_war_and_insurgency: {
    n_scored: 158,
    not_scored_iso: [
      "AND",
      "LIE",
      "MCO",
      "SMR",
      "TUV",
      "NRU",
      "PLW",
      "MHL",
      "FSM",
      "KIR",
      "TON",
      "VAT",
      "VUT",
      "WSM",
      "ATG",
      "BHS",
    ],
  },
  // Terrorism uses CSO indicators + GTD coverage; some small-island gaps.
  terrorist_attack: {
    n_scored: 162,
    not_scored_iso: [
      "AND",
      "LIE",
      "MCO",
      "SMR",
      "TUV",
      "NRU",
      "PLW",
      "MHL",
      "FSM",
      "KIR",
      "VAT",
      "VUT",
    ],
  },
  // Economic recession uses WB national accounts — strong global coverage.
  economic_recession: {
    n_scored: 171,
    not_scored_iso: ["AND", "MCO", "VAT"],
  },
  // Elections uses V-Dem electoral indicators — gap on non-electoral regimes is by-design (still scored as "no election" → low score, not "not_scored"). Coverage gap is small-state V-Dem absence.
  elections_and_voting: {
    n_scored: 164,
    not_scored_iso: [
      "AND",
      "LIE",
      "MCO",
      "SMR",
      "TUV",
      "NRU",
      "PLW",
      "MHL",
      "FSM",
      "VAT",
    ],
  },
};

/**
 * Recipes that are explicitly "queued" / no-walk on the board.
 * Each renders as a greyed row with "no walk yet" cells.
 */
const QUEUED_RECIPES_ON_BOARD = [
  "political_repression",
  "currency_crisis",
  "mass_protest",
  "human_rights_violation",
  "humanitarian_crisis",
  "drought_and_famine",
  "interstate_war",
  "military_coup",
  "democratic_transition",
  "constitutional_change",
];

const EMPTY_QUEUED_CELLS: BoardCell[] = Array.from({ length: 10 }, () => ({
  country: "—",
  score: null,
  state: "no_walk_yet" as const,
}));

export function getRecipeRow(recipeId: string): RecipeRow | null {
  const recipe = getRecipe(recipeId);
  if (!recipe) return null;
  const cells = RECIPE_ROW_CELLS[recipeId];
  if (cells) {
    const display_state: RecipeRow["display_state"] =
      recipe.status === "live_legacy" ? "live_legacy" : "walked_no_graduation";
    const coverage = RECIPE_COVERAGE[recipeId];
    return {
      recipe_id: recipeId,
      cells,
      display_state,
      n_countries_scored: coverage?.n_scored ?? null,
      countries_not_scored_iso: coverage?.not_scored_iso ?? null,
      platform_roster_size: PLATFORM_ROSTER_SIZE,
    };
  }
  return {
    recipe_id: recipeId,
    cells: EMPTY_QUEUED_CELLS,
    display_state: "queued",
    n_countries_scored: null,
    countries_not_scored_iso: null,
    platform_roster_size: PLATFORM_ROSTER_SIZE,
  };
}

/**
 * Recipes shown on the board, in order. Visible (scored) rows first,
 * then a representative queued sample.
 */
export function getBoardRecipeIds(): string[] {
  return [
    "foreign_intervention",
    "civil_war_and_insurgency",
    "terrorist_attack",
    "economic_recession",
    "elections_and_voting",
    ...QUEUED_RECIPES_ON_BOARD,
  ];
}

export function getBoardRecipes(): TrackerRecipe[] {
  const ids = getBoardRecipeIds();
  const lookup = new Map(getAllRecipes().map((r) => [r.recipe_id, r]));
  return ids.map((id) => lookup.get(id)).filter((r): r is TrackerRecipe => Boolean(r));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* RECENT MOVEMENTS — "what just changed"                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Recent movements feed.
 *
 * Per R&D pipeline reply §3 (qgi-docs #169): rank-shift fields are EMPTY at
 * vintage 1 — scores only change when a recipe is re-walked/re-scored
 * (quarterly), so there's no prior bake to diff against. The frontend
 * renders <HistoryAccumulatingGate /> instead.
 *
 * The illustrative array below shows the SHAPE of the eventual data feed
 * (rank shifts vs prior quarterly vintage). Kept for component-shape
 * verification + the future post-vintage-2 state; getRecentMovements()
 * returns [] at current vintage 1.
 */
const RECENT_MOVEMENTS_FUTURE_SHAPE: RankMovement[] = [
  {
    country: "Argentina",
    recipe_id: "economic_recession",
    prior_rank: 4,
    new_rank: 1,
    delta_quarters: 1,
    vs_vintage: "2026-Q2",
    blurb:
      "Inflation re-acceleration + FX-reserve drawdown pulled the country's similarity higher.",
  },
  {
    country: "Tajikistan",
    recipe_id: "foreign_intervention",
    prior_rank: 7,
    new_rank: 5,
    delta_quarters: 1,
    vs_vintage: "2026-Q2",
    blurb:
      "State-capacity indicators drifted further from the canonical shape's recovery arm.",
  },
  {
    country: "Pakistan",
    recipe_id: "terrorist_attack",
    prior_rank: 2,
    new_rank: 1,
    delta_quarters: 1,
    vs_vintage: "2026-Q2",
    blurb: "CSO restriction index moved further inside the historical pre-event band.",
  },
  {
    country: "Sudan",
    recipe_id: "civil_war_and_insurgency",
    prior_rank: 1,
    new_rank: 3,
    delta_quarters: 1,
    vs_vintage: "2026-Q2",
    blurb: "Trajectory smoothing pushed the country one decile down: still HIGH-zone.",
  },
  {
    country: "Equatorial Guinea",
    recipe_id: "foreign_intervention",
    prior_rank: 2,
    new_rank: 3,
    delta_quarters: 1,
    vs_vintage: "2026-Q2",
    blurb: "Reshuffle within the top-band; absolute score nearly unchanged.",
  },
  {
    country: "Turkey",
    recipe_id: "economic_recession",
    prior_rank: 1,
    new_rank: 2,
    delta_quarters: 1,
    vs_vintage: "2026-Q2",
    blurb: "Unemployment series revision narrowed alignment by half a decile.",
  },
  {
    country: "Lebanon",
    recipe_id: "economic_recession",
    prior_rank: 5,
    new_rank: 3,
    delta_quarters: 1,
    vs_vintage: "2026-Q2",
    blurb:
      "Renewed currency depreciation moved the trajectory further into the danger band.",
  },
  {
    country: "Niger",
    recipe_id: "civil_war_and_insurgency",
    prior_rank: 12,
    new_rank: 10,
    delta_quarters: 1,
    vs_vintage: "2026-Q2",
    blurb: "Crossed the row's top-10 threshold; rural governance index slipped further.",
  },
  {
    country: "Ecuador",
    recipe_id: "economic_recession",
    prior_rank: 11,
    new_rank: 10,
    delta_quarters: 1,
    vs_vintage: "2026-Q2",
    blurb: "First appearance inside this row's top-10 since the prior vintage.",
  },
];

/**
 * Returns recent rank movements at the current vintage.
 *
 * Vintage-1 reality: empty array. The pipeline emits an empty feed at the
 * first bake because there's no prior vintage to diff against (R&D reply
 * §3, qgi-docs #169). RecentMovements component renders the
 * HistoryAccumulatingGate when this is empty.
 *
 * The vintage-2+ feed will be quarterly diffs against the prior bake.
 */
export function getRecentMovements(): RankMovement[] {
  // Vintage 1 — empty. The future shape lives in RECENT_MOVEMENTS_FUTURE_SHAPE
  // and will become live data starting at vintage 2.
  void RECENT_MOVEMENTS_FUTURE_SHAPE;
  return [];
}

/**
 * The post-vintage-2 feed. Exposed for component-shape testing + the
 * eventual state. Component reads via getRecentMovements() which returns
 * empty at vintage 1.
 */
export function getRecentMovementsFutureShape(): RankMovement[] {
  return RECENT_MOVEMENTS_FUTURE_SHAPE.slice().sort(
    (a, b) => a.delta_quarters - b.delta_quarters
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** Zone label for a discrimination score (mirrors capability §6 in the guide). */
export function zoneFor(score: number | null): "LOW" | "MODERATE" | "HIGH" | "—" {
  if (score === null) return "—";
  if (score < 40) return "LOW";
  if (score < 65) return "MODERATE";
  return "HIGH";
}
