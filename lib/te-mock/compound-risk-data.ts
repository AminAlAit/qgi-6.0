/**
 * Mock data for the /compound-risk view.
 *
 * Compound score = sum of top-decile margins ((score - 50) for each lit recipe),
 * a transparent stacking heuristic over discrimination ranks. NOT a joint
 * probability : see M8-R5 disclosure on the page.
 *
 * Foreign Intervention is the only recipe rendered with a "graduated" visual
 * signature (its real status is walked_no_graduation pending re-walk; we paint
 * it green here to show what the page LOOKS like with a graduate participating).
 * Every other recipe carries the walked-failed dashed-border treatment per
 * RecipeCard.tsx convention.
 *
 * Country pickings + narratives are plausible-but-fictional research stubs.
 * Will be replaced by curated, dated, ratified case briefs after a second
 * recipe graduates.
 */
import recipeTracker from "@/data/recipe-tracker.json";
import type { TrackerRecipe } from "@/lib/te-mock/recipes";

export interface CompoundLitRecipe {
  recipe_id: string;
  label: string;
  score: number;
  decile: number; // 8 - 10 surfaced on this page
  l1_id: string;
  l1_label: string;
  l1_color: string;
}

export interface CompoundCountry {
  country: string;
  iso: string;
  flag: string;
  region: string;
  compound_score: number;
  lit_recipes: CompoundLitRecipe[];
  lit_families: string[]; // unique L1 ids, in canonical A-H order
  vintage: string;
}

export interface CompoundCaseStudy {
  country: string;
  iso: string;
  flag: string;
  compound_score: number;
  recipes: CompoundLitRecipe[];
  narrative: string;
  vintage: string;
}

export const COMPOUND_VINTAGE = (recipeTracker as { generated: string }).generated;

// Cheap O(1) lookup of recipe metadata.
export const RECIPE_LOOKUP: Record<string, TrackerRecipe> = Object.fromEntries(
  (recipeTracker as { recipes: TrackerRecipe[] }).recipes.map((r) => [r.recipe_id, r])
);

function lit(recipe_id: string, score: number, decile = 9): CompoundLitRecipe {
  const r = RECIPE_LOOKUP[recipe_id];
  if (!r) throw new Error(`compound-risk: unknown recipe_id ${recipe_id}`);
  return {
    recipe_id,
    label: r.label,
    score,
    decile,
    l1_id: r.l1_id,
    l1_label: r.l1_label,
    l1_color: r.l1_color,
  };
}

function compound(recipes: CompoundLitRecipe[]): number {
  // Sum of margins above the 50 (orthogonal) anchor. Transparent stacking heuristic.
  return recipes.reduce((s, r) => s + Math.max(0, r.score - 50), 0);
}

function families(recipes: CompoundLitRecipe[]): string[] {
  return Array.from(new Set(recipes.map((r) => r.l1_id))).sort();
}

interface Seed {
  country: string;
  iso: string;
  flag: string;
  region: string;
  recipes: CompoundLitRecipe[];
}

const SEEDS: Seed[] = [
  {
    country: "Iran",
    iso: "IRN",
    flag: "🇮🇷",
    region: "Middle East",
    recipes: [
      lit("foreign_intervention", 98.1, 10),
      lit("political_repression", 81.4, 10),
      lit("mass_protest", 72.4, 9),
      lit("sanctions_and_arms_embargo", 78.9, 10),
      lit("currency_crisis", 64.2, 9),
    ],
  },
  {
    country: "Pakistan",
    iso: "PAK",
    flag: "🇵🇰",
    region: "South Asia",
    recipes: [
      lit("terrorist_attack", 71.5, 10),
      lit("civil_war_and_insurgency", 66.8, 9),
      lit("economic_recession", 58.2, 8),
      lit("political_violence", 64.5, 9),
    ],
  },
  {
    country: "Argentina",
    iso: "ARG",
    flag: "🇦🇷",
    region: "Latin America",
    recipes: [
      lit("currency_crisis", 82.4, 10),
      lit("economic_recession", 72.1, 10),
      lit("mass_protest", 61.7, 9),
      lit("fiscal_policy_change", 68.3, 9),
    ],
  },
  {
    country: "Myanmar",
    iso: "MMR",
    flag: "🇲🇲",
    region: "Southeast Asia",
    recipes: [
      lit("civil_war_and_insurgency", 77.8, 10),
      lit("foreign_intervention", 71.2, 9),
      lit("political_repression", 74.5, 10),
      lit("ethnic_and_communal_conflict", 68.7, 9),
    ],
  },
  {
    country: "Sudan",
    iso: "SDN",
    flag: "🇸🇩",
    region: "East Africa",
    recipes: [
      lit("civil_war_and_insurgency", 71.2, 10),
      lit("humanitarian_crisis", 78.4, 10),
      lit("foreign_intervention", 65.8, 9),
      lit("drought_and_famine", 62.1, 9),
      lit("mass_protest", 58.7, 8),
    ],
  },
  {
    country: "Lebanon",
    iso: "LBN",
    flag: "🇱🇧",
    region: "Middle East",
    recipes: [
      lit("economic_recession", 65.4, 9),
      lit("currency_crisis", 71.8, 10),
      lit("mass_protest", 61.2, 9),
      lit("banking_and_financial_crisis", 68.5, 9),
    ],
  },
  {
    country: "Belarus",
    iso: "BLR",
    flag: "🇧🇾",
    region: "Eastern Europe",
    recipes: [
      lit("political_repression", 78.2, 10),
      lit("foreign_intervention", 94.2, 10),
      lit("sanctions_and_arms_embargo", 73.6, 10),
    ],
  },
  {
    country: "Turkmenistan",
    iso: "TKM",
    flag: "🇹🇲",
    region: "Central Asia",
    recipes: [
      lit("foreign_intervention", 97.0, 10),
      lit("political_repression", 68.7, 9),
      lit("executive_power_consolidation", 64.3, 9),
    ],
  },
  {
    country: "Tajikistan",
    iso: "TJK",
    flag: "🇹🇯",
    region: "Central Asia",
    recipes: [
      lit("foreign_intervention", 88.5, 10),
      lit("political_repression", 61.8, 9),
      lit("ethnic_and_communal_conflict", 56.4, 8),
    ],
  },
  {
    country: "Yemen",
    iso: "YEM",
    flag: "🇾🇪",
    region: "Middle East",
    recipes: [
      lit("civil_war_and_insurgency", 74.5, 10),
      lit("humanitarian_crisis", 81.2, 10),
      lit("foreign_intervention", 79.8, 10),
      lit("drought_and_famine", 66.4, 9),
      lit("economic_recession", 58.9, 8),
    ],
  },
  {
    country: "Mali",
    iso: "MLI",
    flag: "🇲🇱",
    region: "Sahel",
    recipes: [
      lit("civil_war_and_insurgency", 64.5, 9),
      lit("terrorist_attack", 64.2, 9),
      lit("foreign_intervention", 68.7, 9),
      lit("military_coup", 71.2, 10),
    ],
  },
  {
    country: "Burkina Faso",
    iso: "BFA",
    flag: "🇧🇫",
    region: "Sahel",
    recipes: [
      lit("terrorist_attack", 61.0, 9),
      lit("military_coup", 64.8, 9),
      lit("foreign_intervention", 58.4, 8),
      lit("drought_and_famine", 56.7, 8),
    ],
  },
  {
    country: "Equatorial Guinea",
    iso: "GNQ",
    flag: "🇬🇶",
    region: "West Africa",
    recipes: [
      lit("foreign_intervention", 96.9, 10),
      lit("political_repression", 65.2, 9),
      lit("political_corruption", 71.4, 10),
    ],
  },
  {
    country: "Nicaragua",
    iso: "NIC",
    flag: "🇳🇮",
    region: "Latin America",
    recipes: [
      lit("political_repression", 71.4, 10),
      lit("mass_protest", 54.8, 8),
      lit("economic_recession", 51.3, 8),
    ],
  },
  {
    country: "Sri Lanka",
    iso: "LKA",
    flag: "🇱🇰",
    region: "South Asia",
    recipes: [
      lit("economic_recession", 61.8, 9),
      lit("currency_crisis", 64.7, 9),
      lit("mass_protest", 57.2, 8),
      lit("banking_and_financial_crisis", 59.4, 8),
    ],
  },
  {
    country: "Turkey",
    iso: "TUR",
    flag: "🇹🇷",
    region: "Middle East",
    recipes: [
      lit("economic_recession", 68.5, 9),
      lit("currency_crisis", 71.2, 10),
      lit("political_repression", 58.4, 8),
    ],
  },
  {
    country: "Nigeria",
    iso: "NGA",
    flag: "🇳🇬",
    region: "West Africa",
    recipes: [
      lit("terrorist_attack", 58.5, 8),
      lit("ethnic_and_communal_conflict", 62.1, 9),
      lit("political_violence", 56.3, 8),
    ],
  },
  {
    country: "Venezuela",
    iso: "VEN",
    flag: "🇻🇪",
    region: "Latin America",
    recipes: [
      lit("currency_crisis", 78.4, 10),
      lit("economic_recession", 72.1, 10),
      lit("political_repression", 68.3, 9),
      lit("mass_protest", 54.5, 8),
      lit("sanctions_and_arms_embargo", 64.8, 9),
    ],
  },
  {
    country: "DRC",
    iso: "COD",
    flag: "🇨🇩",
    region: "Central Africa",
    recipes: [
      lit("civil_war_and_insurgency", 68.4, 9),
      lit("ethnic_and_communal_conflict", 64.2, 9),
      lit("humanitarian_crisis", 71.5, 10),
      lit("resource_conflict", 58.7, 8),
    ],
  },
  {
    country: "Egypt",
    iso: "EGY",
    flag: "🇪🇬",
    region: "North Africa",
    recipes: [
      lit("political_repression", 64.1, 9),
      lit("economic_recession", 56.3, 8),
      lit("water_crisis", 53.4, 8),
    ],
  },
  {
    country: "Ethiopia",
    iso: "ETH",
    flag: "🇪🇹",
    region: "East Africa",
    recipes: [
      lit("civil_war_and_insurgency", 61.2, 9),
      lit("ethnic_and_communal_conflict", 64.7, 9),
      lit("drought_and_famine", 58.9, 8),
    ],
  },
  {
    country: "Bolivia",
    iso: "BOL",
    flag: "🇧🇴",
    region: "Latin America",
    recipes: [lit("mass_protest", 54.2, 8), lit("constitutional_change", 52.4, 8)],
  },
];

export const COMPOUND_COUNTRIES: CompoundCountry[] = SEEDS.map((s) => ({
  country: s.country,
  iso: s.iso,
  flag: s.flag,
  region: s.region,
  compound_score: compound(s.recipes),
  lit_recipes: s.recipes,
  lit_families: families(s.recipes),
  vintage: COMPOUND_VINTAGE,
}));

export function countLitAtThreshold(
  countries: CompoundCountry[],
  threshold: number
): number {
  return countries.filter((c) => c.lit_recipes.length >= threshold).length;
}

// ── Case studies ─────────────────────────────────────────────────────────────
// 4-5 sentence analyst paragraphs. Vintage-stamped. MOCK-labeled.

const IRAN = COMPOUND_COUNTRIES.find((c) => c.iso === "IRN")!;
const SUDAN = COMPOUND_COUNTRIES.find((c) => c.iso === "SDN")!;
const ARGENTINA = COMPOUND_COUNTRIES.find((c) => c.iso === "ARG")!;

export const COMPOUND_CASE_STUDIES: CompoundCaseStudy[] = [
  {
    country: IRAN.country,
    iso: IRAN.iso,
    flag: IRAN.flag,
    compound_score: IRAN.compound_score,
    recipes: IRAN.lit_recipes,
    vintage: IRAN.vintage,
    narrative:
      "Iran is the densest single-state compound case currently on the board, lighting up on foreign_intervention, " +
      "political_repression, sanctions_and_arms_embargo, mass_protest, and currency_crisis : three L1 families " +
      "stacking on the same body politic at once (B-Conflict, C-Governance, D-Economic). The structural read is " +
      "that the same indicator pressures : degraded regulatory quality, narrowing civil-liberties space, and " +
      "deteriorating fiscal-source diversity : are simultaneously the inputs that drive the foreign-intervention " +
      "trajectory AND the protest-and-repression cycle, so the compound score is partly a measurement of " +
      "indicator-overlap rather than three independent crisis paths. None of the lit recipes are graduated under " +
      "the current honesty regime, so this is best read as a positioning aggregate, not a forecast of any single " +
      "event firing : and certainly not of all five firing jointly.",
  },
  {
    country: SUDAN.country,
    iso: SUDAN.iso,
    flag: SUDAN.flag,
    compound_score: SUDAN.compound_score,
    recipes: SUDAN.lit_recipes,
    vintage: SUDAN.vintage,
    narrative:
      "Sudan stacks across five recipes : civil_war_and_insurgency, humanitarian_crisis, foreign_intervention, " +
      "drought_and_famine, mass_protest : spanning four L1 families (B-Conflict, E-Social, G-Humanitarian plus a " +
      "structural drought channel under H). Unlike the Iran case, the Sudan stack reflects genuinely distinct " +
      "structural pressures rather than a single indicator bundle: conflict-shape indicators (state-capacity " +
      "collapse, ethnic-violence rates) sit alongside meteorological and humanitarian-throughput signals that draw " +
      "on a non-overlapping data substrate. This is the architecturally cleanest compound case in the current " +
      "vintage, and the one most consistent with the original intuition of the compound page : three independent " +
      "lenses pointing at the same country.",
  },
  {
    country: ARGENTINA.country,
    iso: ARGENTINA.iso,
    flag: ARGENTINA.flag,
    compound_score: ARGENTINA.compound_score,
    recipes: ARGENTINA.lit_recipes,
    vintage: ARGENTINA.vintage,
    narrative:
      "Argentina shows the canonical economic-compound stack: currency_crisis, economic_recession, " +
      "fiscal_policy_change, and mass_protest : three D-Economic recipes plus an E-Social spillover. The reading " +
      "to be careful about here is that currency_crisis and economic_recession share substantial indicator overlap " +
      "(inflation, GDP growth, fiscal-source diversity), so a high compound score is mathematically expected " +
      "rather than informative; the mass_protest light-up is the one independent confirmation that the economic " +
      "stress is propagating into the social domain rather than being absorbed at the policy layer. Until at least " +
      "one of these recipes graduates and earns a confidence band, the Argentina case is a worked example of why " +
      "compound scores need same-family-discount handling in v2.",
  },
];
