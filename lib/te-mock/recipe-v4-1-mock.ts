/**
 * recipe-v4-1-mock — supplementary per-recipe mock fields for V4.1 panels
 * that V4 didn't need: SHAP weights (capability #5), AUC-drop sensitivity
 * (capability #15), score-distribution histogram + quantiles (capability #10),
 * reliability metrics (capability #7), bottom-5 countries (capability #9).
 *
 * Per R&D 2026-05-27 reply:
 *   - shap_weight is a normalized share summing to 100 across the recipe's
 *     selected indicators (not "Others 5%" — selected set IS the full set).
 *   - Indicator count is variable (3-5) per recipe.
 *   - Histogram bin size 10.
 *
 * Mockup-only. Real bake will emit these fields per the contract §3.1.
 */

import { getRecipe, type IndicatorMock } from "./recipes";

export interface IndicatorWithWeight extends IndicatorMock {
  /** Normalized SHAP weight, 0-100. The recipe's selected set sums to ~100. */
  shapWeightPct: number;
  /** AUC drop if this indicator were removed (capability #15). */
  aucDrop: number;
}

export interface HistogramBin {
  bin_lo: number;
  bin_hi: number;
  count: number;
  countries?: string[];
}

export interface ScoreDistribution {
  histogram: HistogramBin[];
  median: number;
  p90: number;
  p99: number;
  max: number;
}

export interface ReliabilityMetrics {
  v1SeparationPp: number;
  v4OotRecallPct: number;
  walksCompleted: number;
  verdict: "LOCK" | "HARD_FAIL" | "MARGINAL" | "VACATED";
}

export interface CountryScore {
  name: string;
  score: number;
}

interface RecipeV4Extras {
  /** Per-indicator SHAP weight + AUC drop. Length = recipe's indicator count. */
  indicators: IndicatorWithWeight[];
  distribution: ScoreDistribution;
  reliability: ReliabilityMetrics;
  /** Bottom-5 by score (low end of the distribution). */
  countriesBottom: CountryScore[];
  /** Sample sufficiency (capability #4). */
  threshold: number;
  thresholdMet: boolean;
  nCohorts: number;
  /** Vintage block (capability §14 — merges into the Identity card per #142). */
  walkId: string;
  walkNumber: number;
  ratifiedBy: string;
  walkDate: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Per-recipe data. Foreign Intervention is the demo-graduated case (fully    */
/* populated). Civil War + Constitutional Change are populated to show the    */
/* variable-N rendering (3 + 5 indicators respectively, per R&D Q1 #2).        */
/* ────────────────────────────────────────────────────────────────────────── */

const EXTRAS: Record<string, RecipeV4Extras> = {
  foreign_intervention: {
    indicators: [
      // R&D Q8 + Q1: normalized SHAP shares sum to 100; weights are
      // illustrative not from a real walk.
      {
        code: "RQ.EST",
        name: "Regulatory Quality",
        provider: "World Bank WGI",
        shapWeightPct: 38,
        aucDrop: 0.083,
      },
      {
        code: "v2pepwrgen",
        name: "Power Distributed by Gender",
        provider: "V-Dem",
        shapWeightPct: 27,
        aucDrop: 0.052,
      },
      {
        code: "v2stfisccap",
        name: "State Fiscal Source",
        provider: "V-Dem",
        shapWeightPct: 20,
        aucDrop: 0.038,
      },
      {
        code: "v2elintmon",
        name: "International Election Monitoring",
        provider: "V-Dem",
        shapWeightPct: 15,
        aucDrop: 0.027,
      },
    ],
    distribution: {
      // Right-skewed: bulk on the left (low scores: most countries), thin tail
      // on the right (high scores: ~5-10 strongly-resembling countries). 10 bins
      // 0-10, 10-20, ..., 90-100. Counts sum to ~167 (n_countries_scored).
      histogram: [
        {
          bin_lo: 0,
          bin_hi: 10,
          count: 38,
          countries: [
            "Switzerland",
            "Norway",
            "Iceland",
            "Sweden",
            "Finland",
            "Denmark",
            "Netherlands",
            "Ireland",
            "New Zealand",
            "Australia",
            "Canada",
            "Austria",
            "Luxembourg",
            "Germany",
            "Belgium",
            "Japan",
            "South Korea",
            "Portugal",
            "Spain",
            "Czech Republic",
            "Slovenia",
            "Estonia",
            "Lithuania",
            "Latvia",
            "Italy",
            "France",
            "United Kingdom",
            "Uruguay",
            "Costa Rica",
            "Chile",
            "Mauritius",
            "Botswana",
            "Mongolia",
            "Slovakia",
            "Poland",
            "Cyprus",
            "Greece",
            "Croatia",
          ],
        },
        {
          bin_lo: 10,
          bin_hi: 20,
          count: 31,
          countries: [
            "Romania",
            "Hungary",
            "Bulgaria",
            "Argentina",
            "Brazil",
            "Mexico",
            "South Africa",
            "Indonesia",
            "Philippines",
            "India",
            "Israel",
            "United States",
            "Albania",
            "Serbia",
            "Bosnia and Herzegovina",
            "North Macedonia",
            "Moldova",
            "Georgia",
            "Tunisia",
            "Senegal",
            "Ghana",
            "Kenya",
            "Namibia",
            "Jamaica",
            "Trinidad and Tobago",
            "Panama",
            "Paraguay",
            "Peru",
            "Ecuador",
            "Colombia",
            "Bolivia",
          ],
        },
        {
          bin_lo: 20,
          bin_hi: 30,
          count: 24,
          countries: [
            "Turkey",
            "Morocco",
            "Lebanon",
            "Jordan",
            "Sri Lanka",
            "Bangladesh",
            "Nepal",
            "Bhutan",
            "Malaysia",
            "Thailand",
            "Vietnam",
            "Mongolia",
            "Armenia",
            "Azerbaijan",
            "Kazakhstan",
            "Kyrgyzstan",
            "Ukraine",
            "Russia",
            "Belarus",
            "Algeria",
            "Egypt",
            "Iraq",
            "Pakistan",
            "Afghanistan",
          ],
        },
        {
          bin_lo: 30,
          bin_hi: 40,
          count: 18,
          countries: [
            "Cambodia",
            "Laos",
            "Myanmar",
            "Nigeria",
            "Uganda",
            "Tanzania",
            "Rwanda",
            "Burundi",
            "Mozambique",
            "Angola",
            "Cameroon",
            "Côte d'Ivoire",
            "Burkina Faso",
            "Mali",
            "Niger",
            "Chad",
            "Guinea",
            "Guinea-Bissau",
          ],
        },
        {
          bin_lo: 40,
          bin_hi: 50,
          count: 14,
          countries: [
            "Honduras",
            "Nicaragua",
            "Guatemala",
            "El Salvador",
            "Venezuela",
            "Haiti",
            "DRC",
            "Central African Republic",
            "Somalia",
            "Ethiopia",
            "Eritrea",
            "Djibouti",
            "Mauritania",
            "Madagascar",
          ],
        },
        {
          bin_lo: 50,
          bin_hi: 60,
          count: 12,
          countries: [
            "Sudan",
            "South Sudan",
            "Libya",
            "Yemen",
            "Syria",
            "Zimbabwe",
            "Comoros",
            "Liberia",
            "Sierra Leone",
            "Togo",
            "Benin",
            "Gabon",
          ],
        },
        {
          bin_lo: 60,
          bin_hi: 70,
          count: 9,
          countries: [
            "Equatorial Guinea (low band)",
            "Iran (low band)",
            "Belarus (low band)",
            "Tajikistan (low band)",
            "Cuba",
            "North Korea",
            "Saudi Arabia",
            "Bahrain",
            "Oman",
          ],
        },
        {
          bin_lo: 70,
          bin_hi: 80,
          count: 7,
          countries: [
            "Syria",
            "Cuba",
            "Nicaragua",
            "Venezuela",
            "Eritrea",
            "Tajikistan",
            "Belarus",
          ],
        },
        {
          bin_lo: 80,
          bin_hi: 90,
          count: 5,
          countries: [
            "Eritrea",
            "Tajikistan",
            "Belarus",
            "Equatorial Guinea",
            "Turkmenistan",
          ],
        },
        {
          bin_lo: 90,
          bin_hi: 100,
          count: 3,
          countries: ["Iran", "Turkmenistan", "Equatorial Guinea"],
        },
      ],
      median: 24,
      p90: 68,
      p99: 96,
      max: 98,
    },
    reliability: {
      v1SeparationPp: 25.8,
      v4OotRecallPct: 86.7,
      walksCompleted: 4,
      // 2026-05-28: demo renders as graduated → show a confident LOCK verdict.
      // The real vacate story is internal (lives on /recipe-tracker + the blog),
      // not surfaced to the recipe-page reader. Header demo-disclosure carries
      // the honest real-status pointer.
      verdict: "LOCK",
    },
    countriesBottom: [
      { name: "Switzerland", score: 5.2 },
      { name: "Iceland", score: 5.8 },
      { name: "Norway", score: 6.4 },
      { name: "New Zealand", score: 7.1 },
      { name: "Finland", score: 8.3 },
    ],
    threshold: 60,
    thresholdMet: true,
    nCohorts: 6,
    walkId: "fi_v4_2026-05-21",
    walkNumber: 4,
    ratifiedBy: "Majles 8/8 · 2026-05-22",
    walkDate: "2026-05-21",
  },

  civil_war_and_insurgency: {
    // R&D Q1 #2 example: 3 indicators.
    indicators: [
      {
        code: "RQ.EST",
        name: "Regulatory Quality",
        provider: "World Bank WGI",
        shapWeightPct: 45,
        aucDrop: 0.072,
      },
      {
        code: "v2x_polyarchy",
        name: "Electoral Democracy Index",
        provider: "V-Dem",
        shapWeightPct: 33,
        aucDrop: 0.054,
      },
      {
        code: "v2psoppaut",
        name: "Opposition Autonomy",
        provider: "V-Dem",
        shapWeightPct: 22,
        aucDrop: 0.034,
      },
    ],
    distribution: {
      histogram: [
        { bin_lo: 0, bin_hi: 10, count: 34 },
        { bin_lo: 10, bin_hi: 20, count: 28 },
        { bin_lo: 20, bin_hi: 30, count: 22 },
        { bin_lo: 30, bin_hi: 40, count: 18 },
        { bin_lo: 40, bin_hi: 50, count: 14 },
        { bin_lo: 50, bin_hi: 60, count: 11 },
        { bin_lo: 60, bin_hi: 70, count: 9 },
        { bin_lo: 70, bin_hi: 80, count: 8 },
        { bin_lo: 80, bin_hi: 90, count: 4 },
        { bin_lo: 90, bin_hi: 100, count: 2 },
      ],
      median: 21,
      p90: 64,
      p99: 88,
      max: 91,
    },
    reliability: {
      v1SeparationPp: 14.2,
      v4OotRecallPct: 48.5,
      walksCompleted: 3,
      verdict: "HARD_FAIL",
    },
    countriesBottom: [
      { name: "Switzerland", score: 4.1 },
      { name: "Iceland", score: 5.0 },
      { name: "Norway", score: 5.8 },
      { name: "Singapore", score: 6.3 },
      { name: "Luxembourg", score: 7.0 },
    ],
    threshold: 60,
    thresholdMet: true,
    nCohorts: 6,
    walkId: "cw_v3_2026-05-08",
    walkNumber: 3,
    ratifiedBy: "Majles · 2026-05-09",
    walkDate: "2026-05-08",
  },

  constitutional_change: {
    // R&D Q1 #2 example: 5 indicators (greedy ran 4-5).
    indicators: [
      {
        code: "v2lginvstp",
        name: "Legislative Investigates Executive",
        provider: "V-Dem",
        shapWeightPct: 30,
        aucDrop: 0.058,
      },
      {
        code: "v2juncind",
        name: "Judicial Independence",
        provider: "V-Dem",
        shapWeightPct: 24,
        aucDrop: 0.044,
      },
      {
        code: "v2x_polyarchy",
        name: "Electoral Democracy Index",
        provider: "V-Dem",
        shapWeightPct: 19,
        aucDrop: 0.033,
      },
      {
        code: "RQ.EST",
        name: "Regulatory Quality",
        provider: "World Bank WGI",
        shapWeightPct: 15,
        aucDrop: 0.026,
      },
      {
        code: "v2csprtcpt",
        name: "Civil Society Participatory Environment",
        provider: "V-Dem",
        shapWeightPct: 12,
        aucDrop: 0.019,
      },
    ],
    distribution: {
      histogram: [
        { bin_lo: 0, bin_hi: 10, count: 22 },
        { bin_lo: 10, bin_hi: 20, count: 26 },
        { bin_lo: 20, bin_hi: 30, count: 24 },
        { bin_lo: 30, bin_hi: 40, count: 21 },
        { bin_lo: 40, bin_hi: 50, count: 17 },
        { bin_lo: 50, bin_hi: 60, count: 14 },
        { bin_lo: 60, bin_hi: 70, count: 10 },
        { bin_lo: 70, bin_hi: 80, count: 6 },
        { bin_lo: 80, bin_hi: 90, count: 4 },
        { bin_lo: 90, bin_hi: 100, count: 2 },
      ],
      median: 28,
      p90: 62,
      p99: 88,
      max: 90,
    },
    reliability: {
      v1SeparationPp: 16.0,
      v4OotRecallPct: 52.0,
      walksCompleted: 2,
      verdict: "MARGINAL",
    },
    countriesBottom: [
      { name: "Switzerland", score: 6.2 },
      { name: "Norway", score: 7.5 },
      { name: "Sweden", score: 8.1 },
      { name: "Denmark", score: 9.0 },
      { name: "Finland", score: 9.4 },
    ],
    threshold: 60,
    thresholdMet: true,
    nCohorts: 6,
    walkId: "cc_v2_2026-04-15",
    walkNumber: 2,
    ratifiedBy: "Majles · 2026-04-16",
    walkDate: "2026-04-15",
  },
};

export function getRecipeV4Extras(recipeId: string): RecipeV4Extras | null {
  return EXTRAS[recipeId] ?? null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Full-list mock data (capability §8/§9 — CountriesPanel expand state).       */
/*                                                                            */
/* Per #158 (founder, 2026-05-26): when the combined CountriesPanel expand    */
/* button is toggled, the panel renders the FULL country roster, not just     */
/* top-5 + bottom-5. The real bake will emit a per-recipe full ranking; this  */
/* mock returns a plausible ~80-country list spanning each recipe's score     */
/* distribution. All names are guaranteed to have a flag-emoji entry in       */
/* country-flags.ts (verified by Talia 2026-05-26 build).                     */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Foreign Intervention — ~80-country roster, descending from 98.1 (Iran)
 * down to 5.2 (Switzerland). Order is structurally driven by the real
 * recipe semantics (autocratic / repressed / fiscally-thin states peak;
 * stable democracies floor). Scores interpolated to give a smooth slope
 * matching the right-skewed mock distribution histogram.
 */
const COUNTRIES_FULL_FOREIGN_INTERVENTION: CountryScore[] = [
  { name: "Iran", score: 98.1 },
  { name: "Turkmenistan", score: 97.0 },
  { name: "Equatorial Guinea", score: 96.9 },
  { name: "Belarus", score: 94.2 },
  { name: "Tajikistan", score: 88.5 },
  { name: "Eritrea", score: 84.7 },
  { name: "Syria", score: 81.3 },
  { name: "North Korea", score: 78.2 },
  { name: "Venezuela", score: 75.8 },
  { name: "Cuba", score: 73.4 },
  { name: "Nicaragua", score: 71.6 },
  { name: "Saudi Arabia", score: 68.9 },
  { name: "Sudan", score: 64.5 },
  { name: "South Sudan", score: 62.7 },
  { name: "Libya", score: 60.8 },
  { name: "Yemen", score: 58.4 },
  { name: "Somalia", score: 55.7 },
  { name: "Central African Republic", score: 53.2 },
  { name: "DRC", score: 51.6 },
  { name: "Ethiopia", score: 48.9 },
  { name: "Honduras", score: 46.4 },
  { name: "Guatemala", score: 44.7 },
  { name: "El Salvador", score: 43.1 },
  { name: "Madagascar", score: 41.5 },
  { name: "Cambodia", score: 39.8 },
  { name: "Laos", score: 38.2 },
  { name: "Myanmar", score: 37.5 },
  { name: "Nigeria", score: 36.1 },
  { name: "Cameroon", score: 35.0 },
  { name: "Uganda", score: 33.7 },
  { name: "Mozambique", score: 32.4 },
  { name: "Burundi", score: 31.2 },
  { name: "Mali", score: 30.5 },
  { name: "Burkina Faso", score: 29.4 },
  { name: "Niger", score: 28.7 },
  { name: "Guinea", score: 28.0 },
  { name: "Afghanistan", score: 27.5 },
  { name: "Pakistan", score: 26.8 },
  { name: "Iraq", score: 26.1 },
  { name: "Egypt", score: 25.4 },
  { name: "Algeria", score: 24.8 },
  { name: "Russia", score: 24.2 },
  { name: "Azerbaijan", score: 23.5 },
  { name: "Kazakhstan", score: 22.7 },
  { name: "Kyrgyzstan", score: 22.0 },
  { name: "Armenia", score: 21.3 },
  { name: "Ukraine", score: 20.6 },
  { name: "Vietnam", score: 19.8 },
  { name: "Thailand", score: 19.2 },
  { name: "Malaysia", score: 18.6 },
  { name: "Bangladesh", score: 17.9 },
  { name: "Nepal", score: 17.3 },
  { name: "Lebanon", score: 16.8 },
  { name: "Jordan", score: 16.2 },
  { name: "Morocco", score: 15.6 },
  { name: "Tunisia", score: 14.9 },
  { name: "Turkey", score: 14.2 },
  { name: "Georgia", score: 13.6 },
  { name: "Moldova", score: 13.0 },
  { name: "Serbia", score: 12.4 },
  { name: "Albania", score: 11.8 },
  { name: "Bosnia and Herzegovina", score: 11.3 },
  { name: "Bulgaria", score: 10.8 },
  { name: "Romania", score: 10.4 },
  { name: "Hungary", score: 10.0 },
  { name: "Mexico", score: 14.5 },
  { name: "Brazil", score: 13.8 },
  { name: "Argentina", score: 12.6 },
  { name: "Colombia", score: 12.1 },
  { name: "India", score: 11.5 },
  { name: "Philippines", score: 11.0 },
  { name: "Indonesia", score: 10.6 },
  { name: "South Africa", score: 10.2 },
  { name: "Israel", score: 9.7 },
  { name: "United States", score: 9.3 },
  { name: "United Kingdom", score: 8.8 },
  { name: "France", score: 8.4 },
  { name: "Italy", score: 8.0 },
  { name: "Spain", score: 7.6 },
  { name: "Germany", score: 7.2 },
  { name: "Belgium", score: 6.9 },
  { name: "Austria", score: 6.6 },
  { name: "Netherlands", score: 6.3 },
  { name: "Portugal", score: 6.0 },
  { name: "Ireland", score: 5.7 },
  { name: "Japan", score: 5.5 },
  { name: "Finland", score: 8.3 },
  { name: "New Zealand", score: 7.1 },
  { name: "Norway", score: 6.4 },
  { name: "Iceland", score: 5.8 },
  { name: "Switzerland", score: 5.2 },
];

const FULL_LISTS: Record<string, CountryScore[]> = {
  foreign_intervention: COUNTRIES_FULL_FOREIGN_INTERVENTION,
};

/**
 * Return the full scored-country roster for a recipe, descending by score.
 * For recipes without a populated mock, synthesize from top + bottom via
 * smooth interpolation across known flag-bearing country names — enough
 * to demo the expand toggle without crashing.
 */
export function getCountriesFull(recipeId: string): CountryScore[] {
  const populated = FULL_LISTS[recipeId];
  if (populated) {
    return [...populated].sort((a, b) => b.score - a.score);
  }
  return synthesizeFullList(recipeId);
}

/* Fallback synth: blends top-5 and bottom-5 with interpolated intermediate */
/* countries pulled from the flag-bearing pool. Returns ~30 entries.        */
const FILLER_POOL = [
  "Russia",
  "Turkey",
  "Egypt",
  "Iraq",
  "Pakistan",
  "Algeria",
  "Mexico",
  "Brazil",
  "Argentina",
  "Colombia",
  "Vietnam",
  "Thailand",
  "Indonesia",
  "Philippines",
  "Nigeria",
  "Kenya",
  "Ghana",
  "Tunisia",
  "Morocco",
  "Jordan",
  "Lebanon",
  "Romania",
  "Hungary",
  "Bulgaria",
  "Serbia",
  "Albania",
  "Georgia",
  "Armenia",
  "Kazakhstan",
  "Uzbekistan",
];

function synthesizeFullList(recipeId: string): CountryScore[] {
  const extras = EXTRAS[recipeId];
  const bottom = extras?.countriesBottom ?? [];
  // recipes.ts is the canonical top source; we don't import it here to keep
  // the helper self-contained — the page passes countriesTop separately.
  // For the synth fallback we just bracket with extras.countriesBottom and a
  // synthetic top derived from filler pool max scores.
  const fillerCount = Math.min(FILLER_POOL.length, 25);
  const peakScore = 80;
  const floorScore = bottom.length > 0 ? bottom[0].score : 10;
  const list: CountryScore[] = [];
  for (let i = 0; i < fillerCount; i++) {
    const t = i / Math.max(1, fillerCount - 1);
    const score = peakScore - t * (peakScore - floorScore - 5);
    list.push({ name: FILLER_POOL[i], score: round1(score) });
  }
  for (const b of bottom) list.push(b);
  return list.sort((a, b) => b.score - a.score);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Fallback extras for recipes without populated V4.1 mock data. Returns
 * sensible defaults so the page renders without crashing — most metrics
 * become section-pending gates.
 */
export function getFallbackExtras(recipeId: string): RecipeV4Extras {
  const recipe = getRecipe(recipeId);
  return {
    indicators: (recipe?.recipe_id ? [] : []) as IndicatorWithWeight[],
    distribution: { histogram: [], median: 0, p90: 0, p99: 0, max: 0 },
    reliability: {
      v1SeparationPp: 0,
      v4OotRecallPct: 0,
      walksCompleted: 0,
      verdict: "HARD_FAIL",
    },
    countriesBottom: [],
    threshold: 60,
    thresholdMet: false,
    nCohorts: 0,
    walkId: "",
    walkNumber: 0,
    ratifiedBy: "",
    walkDate: "",
  };
}
