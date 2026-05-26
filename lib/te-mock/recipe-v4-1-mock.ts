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
  cohortDef: string;
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
      verdict: "VACATED", // demo: graduated but vacated 2026-05-25 per the truncation leak
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
    cohortDef: "LOCO-6",
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
    cohortDef: "LOCO-6",
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
    cohortDef: "LOCO-6",
    ratifiedBy: "Majles · 2026-04-16",
    walkDate: "2026-04-15",
  },
};

export function getRecipeV4Extras(recipeId: string): RecipeV4Extras | null {
  return EXTRAS[recipeId] ?? null;
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
    cohortDef: "",
    ratifiedBy: "",
    walkDate: "",
  };
}
