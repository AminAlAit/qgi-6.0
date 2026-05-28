/**
 * Mock data for the /countries-v4 mockup pages.
 *
 * Each country carries:
 *   - identity (iso, name, region, flag_emoji, population, vintage)
 *   - aggregate (compound_score, recipes_lit_count, recipes_lit_graduated)
 *   - top_recipes: list of {recipe_id, score, label, l1 metadata, status}
 *   - drivers: top-5 V-Dem/WB/WGI indicators currently moving for this
 *     country, each with a 12-quarter trajectory
 *   - momentum: per-top-recipe 12-quarter rank-history sparkline data
 *   - analogs: top-3 historical pre-event-shape matches (foreign keys to
 *     nearest-analog-data when available; plausible fabrications otherwise)
 *   - lit_families: derived list of distinct L1 families lit
 *
 * Country names are deliberately reused from compound-risk-data.ts so the
 * cross-reference into /compound-risk surfaces the same set. All scores
 * are M8-R5 discrimination ranks, NOT probabilities.
 *
 * Mockup only. Local-only branch `local/te-precedents-mockup`.
 */
import recipeTracker from "@/data/recipe-tracker.json";
import { getRecipe, type TrackerRecipe, type RecipeStatus } from "@/lib/te-mock/recipes";
import { getCurrentCountry } from "@/lib/te-mock/nearest-analog-data";

export interface CountryTopRecipe {
  recipe_id: string;
  label: string;
  score: number;
  l1_id: string;
  l1_label: string;
  l1_color: string;
  status: RecipeStatus;
}

/**
 * R&D reply §Q4 (qgi-docs #169): drivers are split into two distinct
 * concepts that must NEVER be conflated in copy.
 *
 *   - CountryDriverAttribution → "why this country scores high":
 *     SHAP signal_share_pct per indicator. Sums to ~100 across the
 *     recipe's indicators. Capability #14 in the ledger.
 *
 *   - CountryDriverMovement → "what's moving in the panels":
 *     Z-trajectory of an indicator + observed z_score_change. Capability
 *     #15 alignment (the observable-substrate side).
 */
export interface CountryDriverAttribution {
  indicator_code: string;
  indicator_name: string;
  provider: string;
  /** SHAP-derived signal share for THIS recipe; 0..100, sums to ~100 across the 4 indicators. */
  signal_share_pct: number;
  /** Which recipe this attribution belongs to — drivers_attribution is per-recipe. */
  recipe_id: string;
}

export interface CountryDriverMovement {
  indicator_code: string;
  indicator_name: string;
  provider: string;
  direction: "rising" | "falling" | "volatile" | "flat";
  /** 12 quarterly values in the recipe-scoring scale (0..100). */
  trajectory: number[];
  /** Observed standardized change over the visible window. */
  z_score_change: number;
}

/** @deprecated Use CountryDriverMovement. Kept as an alias for prior-callsite compat. */
export type CountryDriver = CountryDriverMovement;

export interface CountryMomentum {
  recipe_id: string;
  label: string;
  l1_color: string;
  /** 12 quarterly rank-position values in the 0..100 score scale. */
  rank_history: number[];
}

export interface CountryAnalog {
  country: string;
  year: number;
  match_score: number;
  primary_recipe_id: string;
  what_happened_next: string;
  weak_analog?: boolean;
}

export interface CountryLitFamily {
  l1_id: string;
  l1_label: string;
  l1_color: string;
}

export interface CountryV4 {
  iso: string;
  name: string;
  region: string;
  flag_emoji: string;
  population: number;
  compound_score: number;
  recipes_lit_count: number;
  recipes_lit_graduated: number;
  top_recipes: CountryTopRecipe[];
  /**
   * SHAP attribution: why this country scores high on its TOP-LIT recipe.
   * Per R&D reply §Q4 — distinct from movement. Sums to ~100.
   */
  drivers_attribution: CountryDriverAttribution[];
  /**
   * Indicator movement: what's currently moving in the input panels for
   * this country. Distinct from attribution; never conflate in copy.
   */
  drivers_movement: CountryDriverMovement[];
  /** @deprecated alias of drivers_movement during the schema-align cutover. */
  drivers: CountryDriverMovement[];
  momentum: CountryMomentum[];
  analogs: CountryAnalog[];
  lit_families: CountryLitFamily[];
  vintage: string;
}

const VINTAGE = (recipeTracker as { generated: string }).generated;

export const REGION_ORDER = [
  "Africa",
  "Americas",
  "Asia-Pacific",
  "Europe",
  "MENA",
] as const;

// Country of the week — Kwame's curated mock pick. Iran is the densest
// single-state compound case currently on the board.
export const COUNTRY_OF_THE_WEEK_ISO = "IRN";

// ── Mini seed format ─────────────────────────────────────────────────────
// `recipesLit` carries (recipe_id, score) pairs the country fires on;
// every score is treated as a discrimination rank (0..100). We hydrate
// each pair against the tracker JSON to attach L1 metadata + current
// status, then derive everything else.

interface Seed {
  iso: string;
  name: string;
  region: string;
  flag: string;
  population: number;
  recipesLit: Array<[string, number]>;
  drivers: Array<{
    code: string;
    name: string;
    provider: string;
    shape: "rising" | "falling" | "flat";
    from: number;
    to: number;
  }>;
  analogs?: CountryAnalog[];
}

const SEEDS: Seed[] = [
  // ── MENA ────────────────────────────────────────────────────────────────
  {
    iso: "IRN",
    name: "Iran",
    region: "MENA",
    flag: "🇮🇷",
    population: 89_172_767,
    recipesLit: [
      ["foreign_intervention", 98.1],
      ["political_repression", 81.4],
      ["sanctions_and_arms_embargo", 78.9],
      ["mass_protest", 72.4],
      ["human_rights_violation", 68.7],
      ["currency_crisis", 64.2],
    ],
    drivers: [
      {
        code: "v2x_civlib",
        name: "Civil liberties index",
        provider: "V-Dem",
        shape: "falling",
        from: 68,
        to: 38,
      },
      {
        code: "PV.EST",
        name: "Political Stability",
        provider: "World Bank WGI",
        shape: "falling",
        from: 52,
        to: 24,
      },
      {
        code: "v2elintmon",
        name: "International election monitoring",
        provider: "V-Dem",
        shape: "falling",
        from: 45,
        to: 18,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 42,
        to: 84,
      },
      {
        code: "v2stfisccap",
        name: "State fiscal source",
        provider: "V-Dem",
        shape: "falling",
        from: 58,
        to: 32,
      },
    ],
  },
  {
    iso: "LBN",
    name: "Lebanon",
    region: "MENA",
    flag: "🇱🇧",
    population: 5_490_000,
    recipesLit: [
      ["currency_crisis", 71.8],
      ["banking_and_financial_crisis", 68.5],
      ["economic_recession", 65.4],
      ["mass_protest", 61.2],
    ],
    drivers: [
      {
        code: "FB.AST.NPER.ZS",
        name: "Bank NPL ratio",
        provider: "World Bank",
        shape: "rising",
        from: 32,
        to: 76,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 38,
        to: 88,
      },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
        shape: "rising",
        from: 51,
        to: 82,
      },
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "falling",
        from: 48,
        to: 22,
      },
      {
        code: "v2x_civlib",
        name: "Civil liberties",
        provider: "V-Dem",
        shape: "falling",
        from: 62,
        to: 44,
      },
    ],
  },
  {
    iso: "TUR",
    name: "Türkiye",
    region: "MENA",
    flag: "🇹🇷",
    population: 85_341_241,
    recipesLit: [
      ["currency_crisis", 71.2],
      ["economic_recession", 68.5],
      ["executive_power_consolidation", 68.7],
      ["political_repression", 58.4],
      ["earthquake", 68.7],
    ],
    drivers: [
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 34,
        to: 78,
      },
      {
        code: "v2x_jucon",
        name: "Judicial Constraints on Executive",
        provider: "V-Dem",
        shape: "falling",
        from: 55,
        to: 29,
      },
      {
        code: "v2xlg_legcon",
        name: "Legislative Constraints on Executive",
        provider: "V-Dem",
        shape: "falling",
        from: 52,
        to: 31,
      },
      {
        code: "NE.RSB.GNFS.ZS",
        name: "External balance % GDP",
        provider: "World Bank",
        shape: "falling",
        from: 50,
        to: 26,
      },
      {
        code: "RQ.EST",
        name: "Regulatory Quality",
        provider: "World Bank WGI",
        shape: "falling",
        from: 58,
        to: 38,
      },
    ],
  },
  {
    iso: "EGY",
    name: "Egypt",
    region: "MENA",
    flag: "🇪🇬",
    population: 110_990_000,
    recipesLit: [
      ["political_repression", 64.1],
      ["currency_crisis", 61.7],
      ["economic_recession", 56.3],
      ["water_crisis", 53.4],
    ],
    drivers: [
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 36,
        to: 72,
      },
      {
        code: "v2x_civlib",
        name: "Civil liberties index",
        provider: "V-Dem",
        shape: "falling",
        from: 48,
        to: 28,
      },
      {
        code: "v2cseeorgs",
        name: "CSO entry/exit",
        provider: "V-Dem",
        shape: "falling",
        from: 45,
        to: 24,
      },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
        shape: "rising",
        from: 58,
        to: 84,
      },
      {
        code: "PV.EST",
        name: "Political Stability",
        provider: "World Bank WGI",
        shape: "falling",
        from: 42,
        to: 28,
      },
    ],
  },
  {
    iso: "TUN",
    name: "Tunisia",
    region: "MENA",
    flag: "🇹🇳",
    population: 12_356_000,
    recipesLit: [
      ["constitutional_change", 58.3],
      ["democratic_transition", 54.2],
      ["currency_crisis", 51.4],
    ],
    drivers: [
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "falling",
        from: 72,
        to: 51,
      },
      {
        code: "v2juncind",
        name: "Judicial independence",
        provider: "V-Dem",
        shape: "falling",
        from: 65,
        to: 42,
      },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
        shape: "rising",
        from: 52,
        to: 78,
      },
      {
        code: "v2lginvstp",
        name: "Legislative investigates exec",
        provider: "V-Dem",
        shape: "falling",
        from: 62,
        to: 38,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 41,
        to: 64,
      },
    ],
  },
  {
    iso: "YEM",
    name: "Yemen",
    region: "MENA",
    flag: "🇾🇪",
    population: 33_697_000,
    recipesLit: [
      ["humanitarian_crisis", 81.2],
      ["foreign_intervention", 79.8],
      ["civil_war_and_insurgency", 74.5],
      ["drought_and_famine", 66.4],
      ["economic_recession", 58.9],
    ],
    drivers: [
      {
        code: "VC.BTL.DETH",
        name: "Battle-related deaths",
        provider: "World Bank",
        shape: "rising",
        from: 48,
        to: 82,
      },
      {
        code: "SM.POP.REFG.OR",
        name: "Refugees by origin",
        provider: "World Bank",
        shape: "rising",
        from: 38,
        to: 74,
      },
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "falling",
        from: 32,
        to: 14,
      },
      {
        code: "v2x_clphy",
        name: "Physical Violence Index",
        provider: "V-Dem",
        shape: "rising",
        from: 45,
        to: 81,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 35,
        to: 76,
      },
    ],
  },

  // ── Africa ──────────────────────────────────────────────────────────────
  {
    iso: "SDN",
    name: "Sudan",
    region: "Africa",
    flag: "🇸🇩",
    population: 47_958_856,
    recipesLit: [
      ["humanitarian_crisis", 78.4],
      ["civil_war_and_insurgency", 71.2],
      ["foreign_intervention", 65.8],
      ["drought_and_famine", 62.1],
      ["mass_protest", 58.7],
    ],
    drivers: [
      {
        code: "VC.BTL.DETH",
        name: "Battle-related deaths",
        provider: "World Bank",
        shape: "rising",
        from: 35,
        to: 82,
      },
      {
        code: "SM.POP.REFG.OR",
        name: "Refugees by origin",
        provider: "World Bank",
        shape: "rising",
        from: 40,
        to: 84,
      },
      {
        code: "VC.IDP.NWDS",
        name: "New internal displacements",
        provider: "World Bank",
        shape: "rising",
        from: 38,
        to: 78,
      },
      {
        code: "PV.EST",
        name: "Political Stability",
        provider: "World Bank WGI",
        shape: "falling",
        from: 32,
        to: 12,
      },
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "falling",
        from: 30,
        to: 14,
      },
    ],
  },
  {
    iso: "ETH",
    name: "Ethiopia",
    region: "Africa",
    flag: "🇪🇹",
    population: 126_527_060,
    recipesLit: [
      ["ethnic_and_communal_conflict", 64.7],
      ["civil_war_and_insurgency", 61.2],
      ["drought_and_famine", 58.9],
    ],
    drivers: [
      {
        code: "v2pepwrses",
        name: "Power Distributed by Social Group",
        provider: "V-Dem",
        shape: "falling",
        from: 52,
        to: 28,
      },
      {
        code: "VC.IDP.NWDS",
        name: "New internal displacements",
        provider: "World Bank",
        shape: "rising",
        from: 32,
        to: 68,
      },
      {
        code: "VC.BTL.DETH",
        name: "Battle-related deaths",
        provider: "World Bank",
        shape: "rising",
        from: 38,
        to: 74,
      },
      {
        code: "v2xeg_eqprotec",
        name: "Equal Protection Index",
        provider: "V-Dem",
        shape: "falling",
        from: 48,
        to: 26,
      },
      {
        code: "PV.EST",
        name: "Political Stability",
        provider: "World Bank WGI",
        shape: "falling",
        from: 41,
        to: 22,
      },
    ],
  },
  {
    iso: "NGA",
    name: "Nigeria",
    region: "Africa",
    flag: "🇳🇬",
    population: 223_804_000,
    recipesLit: [
      ["ethnic_and_communal_conflict", 62.1],
      ["terrorist_attack", 58.5],
      ["political_violence", 56.3],
      ["poverty_and_inequality_crisis", 54.1],
    ],
    drivers: [
      {
        code: "v2x_corr",
        name: "Political Corruption Index",
        provider: "V-Dem",
        shape: "rising",
        from: 55,
        to: 78,
      },
      {
        code: "VC.IHR.PSRC.P5",
        name: "Intentional homicide rate",
        provider: "World Bank",
        shape: "rising",
        from: 48,
        to: 72,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 41,
        to: 76,
      },
      {
        code: "v2pepwrses",
        name: "Power Distributed by Social Group",
        provider: "V-Dem",
        shape: "falling",
        from: 52,
        to: 32,
      },
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "falling",
        from: 45,
        to: 28,
      },
    ],
  },
  {
    iso: "COD",
    name: "DR Congo",
    region: "Africa",
    flag: "🇨🇩",
    population: 102_262_000,
    recipesLit: [
      ["humanitarian_crisis", 71.5],
      ["civil_war_and_insurgency", 68.4],
      ["ethnic_and_communal_conflict", 64.2],
      ["resource_conflict", 58.7],
    ],
    drivers: [
      {
        code: "VC.BTL.DETH",
        name: "Battle-related deaths",
        provider: "World Bank",
        shape: "rising",
        from: 42,
        to: 71,
      },
      {
        code: "SM.POP.REFG.OR",
        name: "Refugees by origin",
        provider: "World Bank",
        shape: "rising",
        from: 38,
        to: 68,
      },
      {
        code: "v2x_corr",
        name: "Political Corruption Index",
        provider: "V-Dem",
        shape: "rising",
        from: 64,
        to: 81,
      },
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "falling",
        from: 28,
        to: 14,
      },
      {
        code: "VC.IDP.NWDS",
        name: "New internal displacements",
        provider: "World Bank",
        shape: "rising",
        from: 35,
        to: 64,
      },
    ],
  },
  {
    iso: "GNQ",
    name: "Equatorial Guinea",
    region: "Africa",
    flag: "🇬🇶",
    population: 1_795_000,
    recipesLit: [
      ["foreign_intervention", 96.9],
      ["political_corruption", 71.4],
      ["political_repression", 65.2],
    ],
    drivers: [
      {
        code: "v2x_corr",
        name: "Political Corruption Index",
        provider: "V-Dem",
        shape: "rising",
        from: 74,
        to: 88,
      },
      {
        code: "v2x_neopat",
        name: "Neopatrimonialism Index",
        provider: "V-Dem",
        shape: "rising",
        from: 78,
        to: 91,
      },
      {
        code: "CC.EST",
        name: "Control of Corruption",
        provider: "World Bank WGI",
        shape: "falling",
        from: 22,
        to: 8,
      },
      {
        code: "v2x_civlib",
        name: "Civil liberties index",
        provider: "V-Dem",
        shape: "falling",
        from: 32,
        to: 18,
      },
      {
        code: "RQ.EST",
        name: "Regulatory Quality",
        provider: "World Bank WGI",
        shape: "falling",
        from: 28,
        to: 14,
      },
    ],
  },
  {
    iso: "MLI",
    name: "Mali",
    region: "Africa",
    flag: "🇲🇱",
    population: 23_293_000,
    recipesLit: [
      ["military_coup", 76.4],
      ["foreign_intervention", 68.7],
      ["civil_war_and_insurgency", 64.5],
      ["terrorist_attack", 64.2],
    ],
    drivers: [
      {
        code: "v2x_jucon",
        name: "Judicial Constraints on Executive",
        provider: "V-Dem",
        shape: "falling",
        from: 48,
        to: 18,
      },
      {
        code: "v2xlg_legcon",
        name: "Legislative Constraints on Executive",
        provider: "V-Dem",
        shape: "falling",
        from: 42,
        to: 15,
      },
      {
        code: "VC.BTL.DETH",
        name: "Battle-related deaths",
        provider: "World Bank",
        shape: "rising",
        from: 36,
        to: 71,
      },
      {
        code: "PV.EST",
        name: "Political Stability",
        provider: "World Bank WGI",
        shape: "falling",
        from: 31,
        to: 11,
      },
      {
        code: "v2exl_legitlead",
        name: "Legitimacy of Leadership",
        provider: "V-Dem",
        shape: "falling",
        from: 45,
        to: 22,
      },
    ],
  },
  {
    iso: "BFA",
    name: "Burkina Faso",
    region: "Africa",
    flag: "🇧🇫",
    population: 23_251_000,
    recipesLit: [
      ["military_coup", 64.8],
      ["terrorist_attack", 61.0],
      ["foreign_intervention", 58.4],
      ["drought_and_famine", 56.7],
    ],
    drivers: [
      {
        code: "v2x_jucon",
        name: "Judicial Constraints on Executive",
        provider: "V-Dem",
        shape: "falling",
        from: 44,
        to: 21,
      },
      {
        code: "VC.BTL.DETH",
        name: "Battle-related deaths",
        provider: "World Bank",
        shape: "rising",
        from: 32,
        to: 68,
      },
      {
        code: "v2exl_legitlead",
        name: "Legitimacy of Leadership",
        provider: "V-Dem",
        shape: "falling",
        from: 42,
        to: 24,
      },
      {
        code: "PV.EST",
        name: "Political Stability",
        provider: "World Bank WGI",
        shape: "falling",
        from: 35,
        to: 14,
      },
      {
        code: "SM.POP.REFG.OR",
        name: "Refugees by origin",
        provider: "World Bank",
        shape: "rising",
        from: 28,
        to: 58,
      },
    ],
  },
  {
    iso: "ZAF",
    name: "South Africa",
    region: "Africa",
    flag: "🇿🇦",
    population: 60_414_000,
    recipesLit: [
      ["poverty_and_inequality_crisis", 71.4],
      ["energy_policy", 54.7],
      ["labor_action", 61.8],
    ],
    drivers: [
      {
        code: "SI.POV.GINI",
        name: "Gini index",
        provider: "World Bank",
        shape: "rising",
        from: 78,
        to: 84,
      },
      {
        code: "SL.UEM.1524.ZS",
        name: "Youth unemployment",
        provider: "World Bank",
        shape: "rising",
        from: 65,
        to: 78,
      },
      {
        code: "SL.EMP.VULN.ZS",
        name: "Vulnerable employment %",
        provider: "World Bank",
        shape: "rising",
        from: 52,
        to: 64,
      },
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "falling",
        from: 54,
        to: 38,
      },
      {
        code: "v2x_corr",
        name: "Political Corruption Index",
        provider: "V-Dem",
        shape: "rising",
        from: 51,
        to: 68,
      },
    ],
  },
  {
    iso: "KEN",
    name: "Kenya",
    region: "Africa",
    flag: "🇰🇪",
    population: 55_100_000,
    recipesLit: [
      ["infrastructure_project", 58.4],
      ["ethnic_and_communal_conflict", 52.1],
      ["constitutional_change", 49.7],
    ],
    drivers: [
      {
        code: "BX.KLT.DINV.WD.GD.ZS",
        name: "FDI net inflows",
        provider: "World Bank",
        shape: "rising",
        from: 42,
        to: 58,
      },
      {
        code: "v2pepwrses",
        name: "Power Distributed by Social Group",
        provider: "V-Dem",
        shape: "falling",
        from: 55,
        to: 41,
      },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
        shape: "rising",
        from: 52,
        to: 72,
      },
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "flat",
        from: 58,
        to: 55,
      },
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "flat",
        from: 48,
        to: 46,
      },
    ],
  },

  // ── Americas ────────────────────────────────────────────────────────────
  {
    iso: "ARG",
    name: "Argentina",
    region: "Americas",
    flag: "🇦🇷",
    population: 46_044_000,
    recipesLit: [
      ["currency_crisis", 82.4],
      ["economic_recession", 72.1],
      ["fiscal_policy_change", 68.3],
      ["mass_protest", 61.7],
      ["monetary_policy_change", 59.4],
    ],
    drivers: [
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 51,
        to: 92,
      },
      {
        code: "NE.RSB.GNFS.ZS",
        name: "External balance % GDP",
        provider: "World Bank",
        shape: "falling",
        from: 48,
        to: 22,
      },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
        shape: "rising",
        from: 58,
        to: 84,
      },
      {
        code: "v2stfisccap",
        name: "Fiscal Capacity",
        provider: "V-Dem",
        shape: "falling",
        from: 52,
        to: 32,
      },
      {
        code: "BX.KLT.DINV.WD.GD.ZS",
        name: "FDI net inflows",
        provider: "World Bank",
        shape: "falling",
        from: 42,
        to: 24,
      },
    ],
  },
  {
    iso: "VEN",
    name: "Venezuela",
    region: "Americas",
    flag: "🇻🇪",
    population: 28_838_000,
    recipesLit: [
      ["currency_crisis", 78.4],
      ["political_repression", 73.6],
      ["economic_recession", 72.1],
      ["sanctions_and_arms_embargo", 64.8],
      ["mass_protest", 54.5],
      ["oil_and_gas", 74.2],
    ],
    drivers: [
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 61,
        to: 96,
      },
      {
        code: "SM.POP.REFG.OR",
        name: "Refugees by origin",
        provider: "World Bank",
        shape: "rising",
        from: 35,
        to: 81,
      },
      {
        code: "v2x_civlib",
        name: "Civil liberties index",
        provider: "V-Dem",
        shape: "falling",
        from: 42,
        to: 14,
      },
      {
        code: "v2x_corr",
        name: "Political Corruption Index",
        provider: "V-Dem",
        shape: "rising",
        from: 68,
        to: 89,
      },
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "falling",
        from: 31,
        to: 9,
      },
    ],
  },
  {
    iso: "BOL",
    name: "Bolivia",
    region: "Americas",
    flag: "🇧🇴",
    population: 12_186_000,
    recipesLit: [
      ["mass_protest", 54.2],
      ["constitutional_change", 52.4],
    ],
    drivers: [
      {
        code: "v2juncind",
        name: "Judicial independence",
        provider: "V-Dem",
        shape: "falling",
        from: 54,
        to: 36,
      },
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "falling",
        from: 61,
        to: 48,
      },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
        shape: "rising",
        from: 38,
        to: 58,
      },
      {
        code: "NE.RSB.GNFS.ZS",
        name: "External balance % GDP",
        provider: "World Bank",
        shape: "falling",
        from: 52,
        to: 32,
      },
      {
        code: "v2lginvstp",
        name: "Legislative investigates exec",
        provider: "V-Dem",
        shape: "falling",
        from: 55,
        to: 41,
      },
    ],
  },
  {
    iso: "NIC",
    name: "Nicaragua",
    region: "Americas",
    flag: "🇳🇮",
    population: 7_046_000,
    recipesLit: [
      ["political_repression", 71.4],
      ["mass_protest", 54.8],
      ["economic_recession", 51.3],
    ],
    drivers: [
      {
        code: "v2x_civlib",
        name: "Civil liberties index",
        provider: "V-Dem",
        shape: "falling",
        from: 48,
        to: 16,
      },
      {
        code: "v2cseeorgs",
        name: "CSO entry/exit",
        provider: "V-Dem",
        shape: "falling",
        from: 45,
        to: 14,
      },
      {
        code: "v2psoppaut",
        name: "Opposition autonomy",
        provider: "V-Dem",
        shape: "falling",
        from: 38,
        to: 12,
      },
      {
        code: "v2juncind",
        name: "Judicial independence",
        provider: "V-Dem",
        shape: "falling",
        from: 42,
        to: 18,
      },
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "falling",
        from: 51,
        to: 22,
      },
    ],
  },
  {
    iso: "COL",
    name: "Colombia",
    region: "Americas",
    flag: "🇨🇴",
    population: 51_874_000,
    recipesLit: [
      ["peacekeeping_and_peace_process", 61.5],
      ["transitional_justice", 64.2],
      ["political_violence", 61.4],
    ],
    drivers: [
      {
        code: "VC.BTL.DETH",
        name: "Battle-related deaths",
        provider: "World Bank",
        shape: "falling",
        from: 64,
        to: 38,
      },
      {
        code: "v2juncind",
        name: "Judicial independence",
        provider: "V-Dem",
        shape: "rising",
        from: 48,
        to: 62,
      },
      {
        code: "v2x_rule",
        name: "Rule of Law Index",
        provider: "V-Dem",
        shape: "rising",
        from: 44,
        to: 58,
      },
      {
        code: "VC.IDP.NWDS",
        name: "New internal displacements",
        provider: "World Bank",
        shape: "falling",
        from: 58,
        to: 35,
      },
      {
        code: "SM.POP.REFG.OR",
        name: "Refugees by origin",
        provider: "World Bank",
        shape: "rising",
        from: 32,
        to: 51,
      },
    ],
  },
  {
    iso: "MEX",
    name: "Mexico",
    region: "Americas",
    flag: "🇲🇽",
    population: 128_455_000,
    recipesLit: [
      ["political_violence", 68.1],
      ["government_formation", 61.7],
      ["public_health_reform", 53.4],
    ],
    drivers: [
      {
        code: "VC.IHR.PSRC.P5",
        name: "Intentional homicide rate",
        provider: "World Bank",
        shape: "rising",
        from: 58,
        to: 76,
      },
      {
        code: "v2x_corr",
        name: "Political Corruption Index",
        provider: "V-Dem",
        shape: "rising",
        from: 54,
        to: 68,
      },
      {
        code: "v2clkill",
        name: "Freedom from Political Killings",
        provider: "V-Dem",
        shape: "falling",
        from: 52,
        to: 32,
      },
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "flat",
        from: 48,
        to: 45,
      },
      {
        code: "v2juncind",
        name: "Judicial independence",
        provider: "V-Dem",
        shape: "falling",
        from: 51,
        to: 38,
      },
    ],
  },
  {
    iso: "BRA",
    name: "Brazil",
    region: "Americas",
    flag: "🇧🇷",
    population: 216_422_000,
    recipesLit: [
      ["poverty_and_inequality_crisis", 64.8],
      ["religious_and_social_movement", 51.4],
      ["monetary_policy_change", 54.8],
    ],
    drivers: [
      {
        code: "SI.POV.GINI",
        name: "Gini index",
        provider: "World Bank",
        shape: "rising",
        from: 68,
        to: 75,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 42,
        to: 61,
      },
      {
        code: "v2csprtcpt",
        name: "CSO Participatory Env.",
        provider: "V-Dem",
        shape: "rising",
        from: 51,
        to: 64,
      },
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "flat",
        from: 62,
        to: 60,
      },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
        shape: "rising",
        from: 58,
        to: 72,
      },
    ],
  },
  {
    iso: "CHL",
    name: "Chile",
    region: "Americas",
    flag: "🇨🇱",
    population: 19_605_000,
    recipesLit: [
      ["constitutional_change", 58.3],
      ["mass_protest", 51.8],
      ["multilateral_agreement", 54.4],
    ],
    drivers: [
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "rising",
        from: 68,
        to: 75,
      },
      {
        code: "SI.POV.GINI",
        name: "Gini index",
        provider: "World Bank",
        shape: "falling",
        from: 64,
        to: 51,
      },
      {
        code: "v2csprtcpt",
        name: "CSO Participatory Env.",
        provider: "V-Dem",
        shape: "rising",
        from: 58,
        to: 68,
      },
      {
        code: "NE.TRD.GNFS.ZS",
        name: "Trade % GDP",
        provider: "World Bank",
        shape: "rising",
        from: 52,
        to: 64,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 35,
        to: 51,
      },
    ],
  },

  // ── Asia-Pacific ────────────────────────────────────────────────────────
  {
    iso: "PAK",
    name: "Pakistan",
    region: "Asia-Pacific",
    flag: "🇵🇰",
    population: 240_485_000,
    recipesLit: [
      ["terrorist_attack", 71.5],
      ["civil_war_and_insurgency", 66.8],
      ["political_violence", 64.5],
      ["economic_recession", 58.2],
      ["currency_crisis", 57.2],
    ],
    drivers: [
      {
        code: "PV.EST",
        name: "Political Stability",
        provider: "World Bank WGI",
        shape: "falling",
        from: 35,
        to: 14,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 41,
        to: 78,
      },
      {
        code: "v2cseeorgs",
        name: "CSO entry/exit",
        provider: "V-Dem",
        shape: "falling",
        from: 48,
        to: 28,
      },
      {
        code: "VC.BTL.DETH",
        name: "Battle-related deaths",
        provider: "World Bank",
        shape: "rising",
        from: 38,
        to: 62,
      },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
        shape: "rising",
        from: 54,
        to: 78,
      },
    ],
  },
  {
    iso: "MMR",
    name: "Myanmar",
    region: "Asia-Pacific",
    flag: "🇲🇲",
    population: 54_578_000,
    recipesLit: [
      ["civil_war_and_insurgency", 77.8],
      ["political_repression", 74.5],
      ["foreign_intervention", 71.2],
      ["ethnic_and_communal_conflict", 68.7],
      ["human_rights_violation", 71.4],
    ],
    drivers: [
      {
        code: "v2x_clphy",
        name: "Physical Violence Index",
        provider: "V-Dem",
        shape: "rising",
        from: 45,
        to: 88,
      },
      {
        code: "VC.BTL.DETH",
        name: "Battle-related deaths",
        provider: "World Bank",
        shape: "rising",
        from: 35,
        to: 78,
      },
      {
        code: "SM.POP.REFG.OR",
        name: "Refugees by origin",
        provider: "World Bank",
        shape: "rising",
        from: 42,
        to: 81,
      },
      {
        code: "v2clkill",
        name: "Freedom from Political Killings",
        provider: "V-Dem",
        shape: "falling",
        from: 32,
        to: 8,
      },
      {
        code: "v2x_civlib",
        name: "Civil liberties index",
        provider: "V-Dem",
        shape: "falling",
        from: 28,
        to: 7,
      },
    ],
  },
  {
    iso: "LKA",
    name: "Sri Lanka",
    region: "Asia-Pacific",
    flag: "🇱🇰",
    population: 21_894_000,
    recipesLit: [
      ["currency_crisis", 64.7],
      ["economic_recession", 61.8],
      ["banking_and_financial_crisis", 59.4],
      ["mass_protest", 57.2],
    ],
    drivers: [
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
        shape: "rising",
        from: 58,
        to: 92,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 38,
        to: 81,
      },
      {
        code: "DT.DOD.DSTC.ZS",
        name: "Short-term debt %",
        provider: "World Bank",
        shape: "rising",
        from: 48,
        to: 74,
      },
      {
        code: "NE.RSB.GNFS.ZS",
        name: "External balance % GDP",
        provider: "World Bank",
        shape: "falling",
        from: 45,
        to: 18,
      },
      {
        code: "v2csprtcpt",
        name: "CSO Participatory Env.",
        provider: "V-Dem",
        shape: "rising",
        from: 51,
        to: 68,
      },
    ],
  },
  {
    iso: "AFG",
    name: "Afghanistan",
    region: "Asia-Pacific",
    flag: "🇦🇫",
    population: 42_239_000,
    recipesLit: [
      ["foreign_intervention", 84.2],
      ["civil_war_and_insurgency", 81.8],
      ["humanitarian_crisis", 78.4],
      ["migration_and_refugees", 74.3],
      ["human_rights_violation", 71.2],
    ],
    drivers: [
      {
        code: "SM.POP.REFG.OR",
        name: "Refugees by origin",
        provider: "World Bank",
        shape: "rising",
        from: 48,
        to: 88,
      },
      {
        code: "v2x_clphy",
        name: "Physical Violence Index",
        provider: "V-Dem",
        shape: "rising",
        from: 51,
        to: 84,
      },
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "falling",
        from: 22,
        to: 5,
      },
      {
        code: "VC.IDP.NWDS",
        name: "New internal displacements",
        provider: "World Bank",
        shape: "rising",
        from: 42,
        to: 76,
      },
      {
        code: "v2x_civlib",
        name: "Civil liberties index",
        provider: "V-Dem",
        shape: "falling",
        from: 31,
        to: 4,
      },
    ],
  },
  {
    iso: "TKM",
    name: "Turkmenistan",
    region: "Asia-Pacific",
    flag: "🇹🇲",
    population: 6_516_000,
    recipesLit: [
      ["foreign_intervention", 97.0],
      ["political_repression", 68.7],
      ["executive_power_consolidation", 64.3],
    ],
    drivers: [
      {
        code: "v2x_civlib",
        name: "Civil liberties index",
        provider: "V-Dem",
        shape: "falling",
        from: 18,
        to: 5,
      },
      {
        code: "v2cseeorgs",
        name: "CSO entry/exit",
        provider: "V-Dem",
        shape: "falling",
        from: 14,
        to: 3,
      },
      {
        code: "v2psoppaut",
        name: "Opposition autonomy",
        provider: "V-Dem",
        shape: "falling",
        from: 12,
        to: 2,
      },
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "falling",
        from: 14,
        to: 4,
      },
      {
        code: "v2x_neopat",
        name: "Neopatrimonialism Index",
        provider: "V-Dem",
        shape: "rising",
        from: 78,
        to: 92,
      },
    ],
  },
  {
    iso: "TJK",
    name: "Tajikistan",
    region: "Asia-Pacific",
    flag: "🇹🇯",
    population: 10_143_000,
    recipesLit: [
      ["foreign_intervention", 88.5],
      ["political_repression", 61.8],
      ["ethnic_and_communal_conflict", 56.4],
    ],
    drivers: [
      {
        code: "v2x_civlib",
        name: "Civil liberties index",
        provider: "V-Dem",
        shape: "falling",
        from: 32,
        to: 14,
      },
      {
        code: "v2cseeorgs",
        name: "CSO entry/exit",
        provider: "V-Dem",
        shape: "falling",
        from: 28,
        to: 11,
      },
      {
        code: "v2juncind",
        name: "Judicial independence",
        provider: "V-Dem",
        shape: "falling",
        from: 31,
        to: 18,
      },
      {
        code: "v2x_corr",
        name: "Political Corruption Index",
        provider: "V-Dem",
        shape: "rising",
        from: 62,
        to: 78,
      },
      {
        code: "PV.EST",
        name: "Political Stability",
        provider: "World Bank WGI",
        shape: "falling",
        from: 42,
        to: 28,
      },
    ],
  },
  {
    iso: "PHL",
    name: "Philippines",
    region: "Asia-Pacific",
    flag: "🇵🇭",
    population: 117_337_000,
    recipesLit: [
      ["political_violence", 64.8],
      ["territorial_disputes", 54.1],
      ["foreign_direct_investment", 51.2],
    ],
    drivers: [
      {
        code: "v2clkill",
        name: "Freedom from Political Killings",
        provider: "V-Dem",
        shape: "falling",
        from: 45,
        to: 28,
      },
      {
        code: "v2x_clphy",
        name: "Physical Violence Index",
        provider: "V-Dem",
        shape: "rising",
        from: 48,
        to: 64,
      },
      {
        code: "v2svdomaut",
        name: "Domestic Autonomy",
        provider: "V-Dem",
        shape: "falling",
        from: 58,
        to: 41,
      },
      {
        code: "VC.IHR.PSRC.P5",
        name: "Intentional homicide rate",
        provider: "World Bank",
        shape: "rising",
        from: 41,
        to: 58,
      },
      {
        code: "BX.KLT.DINV.WD.GD.ZS",
        name: "FDI net inflows",
        provider: "World Bank",
        shape: "flat",
        from: 45,
        to: 48,
      },
    ],
  },
  {
    iso: "IND",
    name: "India",
    region: "Asia-Pacific",
    flag: "🇮🇳",
    population: 1_428_628_000,
    recipesLit: [
      ["executive_power_consolidation", 58.1],
      ["ethnic_and_communal_conflict", 61.7],
      ["religious_and_social_movement", 61.5],
    ],
    drivers: [
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "falling",
        from: 62,
        to: 48,
      },
      {
        code: "v2juncind",
        name: "Judicial independence",
        provider: "V-Dem",
        shape: "falling",
        from: 58,
        to: 42,
      },
      {
        code: "v2cseeorgs",
        name: "CSO entry/exit",
        provider: "V-Dem",
        shape: "falling",
        from: 54,
        to: 38,
      },
      {
        code: "v2pepwrses",
        name: "Power Distributed by Social Group",
        provider: "V-Dem",
        shape: "falling",
        from: 52,
        to: 38,
      },
      {
        code: "v2lginvstp",
        name: "Legislative investigates exec",
        provider: "V-Dem",
        shape: "falling",
        from: 51,
        to: 35,
      },
    ],
  },
  {
    iso: "IDN",
    name: "Indonesia",
    region: "Asia-Pacific",
    flag: "🇮🇩",
    population: 277_534_000,
    recipesLit: [
      ["democratic_transition", 55.7],
      ["earthquake", 61.8],
      ["religious_and_social_movement", 51.7],
    ],
    drivers: [
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "flat",
        from: 62,
        to: 61,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 38,
        to: 52,
      },
      {
        code: "RQ.EST",
        name: "Regulatory Quality",
        provider: "World Bank WGI",
        shape: "rising",
        from: 48,
        to: 58,
      },
      {
        code: "BX.KLT.DINV.WD.GD.ZS",
        name: "FDI net inflows",
        provider: "World Bank",
        shape: "rising",
        from: 42,
        to: 58,
      },
      {
        code: "v2x_civlib",
        name: "Civil liberties",
        provider: "V-Dem",
        shape: "falling",
        from: 58,
        to: 48,
      },
    ],
  },

  // ── Europe ──────────────────────────────────────────────────────────────
  {
    iso: "BLR",
    name: "Belarus",
    region: "Europe",
    flag: "🇧🇾",
    population: 9_498_000,
    recipesLit: [
      ["foreign_intervention", 94.2],
      ["political_repression", 78.2],
      ["sanctions_and_arms_embargo", 73.6],
    ],
    drivers: [
      {
        code: "v2x_civlib",
        name: "Civil liberties index",
        provider: "V-Dem",
        shape: "falling",
        from: 38,
        to: 11,
      },
      {
        code: "v2cseeorgs",
        name: "CSO entry/exit",
        provider: "V-Dem",
        shape: "falling",
        from: 32,
        to: 8,
      },
      {
        code: "v2psoppaut",
        name: "Opposition autonomy",
        provider: "V-Dem",
        shape: "falling",
        from: 31,
        to: 6,
      },
      {
        code: "v2juncind",
        name: "Judicial independence",
        provider: "V-Dem",
        shape: "falling",
        from: 38,
        to: 14,
      },
      {
        code: "v2svdomaut",
        name: "Domestic Autonomy",
        provider: "V-Dem",
        shape: "falling",
        from: 42,
        to: 18,
      },
    ],
  },
  {
    iso: "UKR",
    name: "Ukraine",
    region: "Europe",
    flag: "🇺🇦",
    population: 38_000_000,
    recipesLit: [
      ["interstate_war", 84.7],
      ["foreign_intervention", 81.4],
      ["humanitarian_crisis", 71.2],
      ["migration_and_refugees", 68.4],
      ["cyberattack", 71.4],
    ],
    drivers: [
      {
        code: "VC.BTL.DETH",
        name: "Battle-related deaths",
        provider: "World Bank",
        shape: "rising",
        from: 35,
        to: 92,
      },
      {
        code: "SM.POP.REFG.OR",
        name: "Refugees by origin",
        provider: "World Bank",
        shape: "rising",
        from: 22,
        to: 88,
      },
      {
        code: "VC.IDP.NWDS",
        name: "New internal displacements",
        provider: "World Bank",
        shape: "rising",
        from: 18,
        to: 78,
      },
      {
        code: "v2svdomaut",
        name: "Domestic Autonomy",
        provider: "V-Dem",
        shape: "falling",
        from: 58,
        to: 31,
      },
      {
        code: "v2x_clphy",
        name: "Physical Violence Index",
        provider: "V-Dem",
        shape: "rising",
        from: 32,
        to: 84,
      },
    ],
  },
  {
    iso: "HUN",
    name: "Hungary",
    region: "Europe",
    flag: "🇭🇺",
    population: 9_589_000,
    recipesLit: [
      ["executive_power_consolidation", 71.4],
      ["constitutional_change", 58.2],
    ],
    drivers: [
      {
        code: "v2x_jucon",
        name: "Judicial Constraints on Executive",
        provider: "V-Dem",
        shape: "falling",
        from: 58,
        to: 31,
      },
      {
        code: "v2xlg_legcon",
        name: "Legislative Constraints on Exec",
        provider: "V-Dem",
        shape: "falling",
        from: 54,
        to: 28,
      },
      {
        code: "v2lginvstp",
        name: "Legislative investigates exec",
        provider: "V-Dem",
        shape: "falling",
        from: 52,
        to: 32,
      },
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "falling",
        from: 62,
        to: 44,
      },
      {
        code: "RQ.EST",
        name: "Regulatory Quality",
        provider: "World Bank WGI",
        shape: "falling",
        from: 58,
        to: 42,
      },
    ],
  },
  {
    iso: "GRC",
    name: "Greece",
    region: "Europe",
    flag: "🇬🇷",
    population: 10_394_000,
    recipesLit: [
      ["fiscal_policy_change", 64.1],
      ["banking_and_financial_crisis", 54.7],
      ["economic_recovery", 58.2],
    ],
    drivers: [
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
        shape: "falling",
        from: 82,
        to: 64,
      },
      {
        code: "NY.GDP.MKTP.KD.ZG",
        name: "GDP growth",
        provider: "World Bank",
        shape: "rising",
        from: 32,
        to: 58,
      },
      {
        code: "SL.UEM.TOTL.ZS",
        name: "Unemployment",
        provider: "World Bank",
        shape: "falling",
        from: 78,
        to: 51,
      },
      {
        code: "BX.KLT.DINV.WD.GD.ZS",
        name: "FDI net inflows",
        provider: "World Bank",
        shape: "rising",
        from: 42,
        to: 58,
      },
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "rising",
        from: 51,
        to: 62,
      },
    ],
  },
  {
    iso: "DEU",
    name: "Germany",
    region: "Europe",
    flag: "🇩🇪",
    population: 84_482_000,
    recipesLit: [
      ["energy_policy", 58.4],
      ["multilateral_agreement", 54.1],
    ],
    drivers: [
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "flat",
        from: 88,
        to: 85,
      },
      {
        code: "NE.TRD.GNFS.ZS",
        name: "Trade % GDP",
        provider: "World Bank",
        shape: "flat",
        from: 78,
        to: 75,
      },
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "flat",
        from: 82,
        to: 81,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 32,
        to: 48,
      },
      {
        code: "RQ.EST",
        name: "Regulatory Quality",
        provider: "World Bank WGI",
        shape: "flat",
        from: 81,
        to: 78,
      },
    ],
  },
  {
    iso: "GBR",
    name: "United Kingdom",
    region: "Europe",
    flag: "🇬🇧",
    population: 67_736_000,
    recipesLit: [
      ["cyberattack", 51.2],
      ["multilateral_agreement", 49.4],
    ],
    drivers: [
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "flat",
        from: 78,
        to: 76,
      },
      {
        code: "RQ.EST",
        name: "Regulatory Quality",
        provider: "World Bank WGI",
        shape: "flat",
        from: 82,
        to: 79,
      },
      {
        code: "NE.TRD.GNFS.ZS",
        name: "Trade % GDP",
        provider: "World Bank",
        shape: "falling",
        from: 65,
        to: 54,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 31,
        to: 52,
      },
      {
        code: "GE.EST",
        name: "Government Effectiveness",
        provider: "World Bank WGI",
        shape: "flat",
        from: 78,
        to: 75,
      },
    ],
  },
  {
    iso: "POL",
    name: "Poland",
    region: "Europe",
    flag: "🇵🇱",
    population: 41_026_000,
    recipesLit: [
      ["religious_and_social_movement", 57.8],
      ["regional_integration", 48.5],
    ],
    drivers: [
      {
        code: "v2juncind",
        name: "Judicial independence",
        provider: "V-Dem",
        shape: "rising",
        from: 38,
        to: 51,
      },
      {
        code: "v2x_polyarchy",
        name: "Electoral democracy",
        provider: "V-Dem",
        shape: "rising",
        from: 58,
        to: 68,
      },
      {
        code: "RQ.EST",
        name: "Regulatory Quality",
        provider: "World Bank WGI",
        shape: "rising",
        from: 62,
        to: 71,
      },
      {
        code: "FP.CPI.TOTL.ZG",
        name: "Inflation, CPI",
        provider: "World Bank",
        shape: "rising",
        from: 38,
        to: 51,
      },
      {
        code: "NE.TRD.GNFS.ZS",
        name: "Trade % GDP",
        provider: "World Bank",
        shape: "rising",
        from: 58,
        to: 71,
      },
    ],
  },
  {
    iso: "RUS",
    name: "Russia",
    region: "Europe",
    flag: "🇷🇺",
    population: 144_236_000,
    recipesLit: [
      ["sanctions_and_arms_embargo", 74.7],
      ["foreign_intervention", 71.8],
      ["diplomatic_rupture", 71.8],
      ["political_repression", 64.5],
    ],
    drivers: [
      {
        code: "v2x_civlib",
        name: "Civil liberties index",
        provider: "V-Dem",
        shape: "falling",
        from: 38,
        to: 12,
      },
      {
        code: "v2cseeorgs",
        name: "CSO entry/exit",
        provider: "V-Dem",
        shape: "falling",
        from: 31,
        to: 8,
      },
      {
        code: "v2svdomaut",
        name: "Domestic Autonomy",
        provider: "V-Dem",
        shape: "rising",
        from: 62,
        to: 81,
      },
      {
        code: "NE.RSB.GNFS.ZS",
        name: "External balance % GDP",
        provider: "World Bank",
        shape: "rising",
        from: 51,
        to: 68,
      },
      {
        code: "v2psoppaut",
        name: "Opposition autonomy",
        provider: "V-Dem",
        shape: "falling",
        from: 32,
        to: 8,
      },
    ],
  },
];

// ── Trajectory + analog hydration ────────────────────────────────────────

function buildTrajectory(
  shape: "rising" | "falling" | "flat",
  from: number,
  to: number,
  iso: string,
  code: string
): number[] {
  // Deterministic per-(iso, code) pseudo-noise so trajectories are stable
  // across renders. Simple LCG seeded on a hash of "iso:code".
  let h = 2166136261;
  const s = `${iso}:${code}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rng = () => {
    h = Math.imul(48271, h) | 0;
    return ((h >>> 0) / 0xffffffff - 0.5) * 6;
  };
  const out: number[] = [];
  for (let q = 0; q < 12; q++) {
    const t = q / 11;
    let base: number;
    if (shape === "flat") {
      base = from + (to - from) * t;
    } else {
      // Slight S-curve so the line doesn't look mechanical.
      const eased = t * t * (3 - 2 * t);
      base = from + (to - from) * eased;
    }
    out.push(Math.max(0, Math.min(100, base + rng())));
  }
  // Pin endpoints so direction always reads true.
  out[0] = Math.max(0, Math.min(100, from));
  out[11] = Math.max(0, Math.min(100, to));
  return out;
}

function buildRankHistory(iso: string, recipeId: string, currentScore: number): number[] {
  // Same hash-seeded RNG as buildTrajectory, scoped to (iso, recipe).
  // 12-quarter walk that lands on `currentScore` at q=11.
  let h = 5381;
  const s = `${iso}:rank:${recipeId}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  const rng = () => {
    h = Math.imul(48271, h) | 0;
    return ((h >>> 0) / 0xffffffff - 0.5) * 8;
  };
  // Start near 50 (median) and drift toward currentScore with noise.
  const start = 50 + (rng() / 8) * 20;
  const out: number[] = [];
  for (let q = 0; q < 12; q++) {
    const t = q / 11;
    const base = start + (currentScore - start) * (t * t * (3 - 2 * t));
    out.push(Math.max(0, Math.min(100, base + rng())));
  }
  out[11] = Math.max(0, Math.min(100, currentScore));
  return out;
}

// Plausible mock analogs by country profile. Used as fallbacks when
// nearest-analog-data.ts doesn't carry an entry for the ISO. Each tuple
// is (country, year, match_score, primary_recipe_id, what_happened_next).
type AnalogTuple = [string, number, number, string, string];

// Per-family (L1) analog pools — keyed by L1 id (A..H).
// Self-exclusion is applied at call time.
const ANALOG_POOLS_BY_FAMILY: Record<string, AnalogTuple[]> = {
  // B — Conflict & Violence
  B: [
    [
      "Yemen",
      2014,
      74.8,
      "civil_war_and_insurgency",
      "The Houthi movement seized Sanaa in September 2014. Saudi-led coalition air strikes began in March 2015, triggering a multi-sided civil war that by 2023 had displaced over 4 million people and produced the world's largest humanitarian crisis.",
    ],
    [
      "Iraq",
      2014,
      71.2,
      "foreign_intervention",
      "ISIS seized Mosul and declared a caliphate in June 2014. A US-led coalition launched air strikes in August 2014; ground operations by Iraqi forces, Kurdish Peshmerga, and Iranian-backed militias followed. Mosul was retaken in July 2017.",
    ],
    [
      "Mali",
      2012,
      66.5,
      "civil_war_and_insurgency",
      "AQIM-linked MNLA rebels seized northern Mali in March–April 2012 following a military coup. French Operation Serval launched in January 2013; the UN MINUSMA mission deployed in July 2013. Insurgency persisted through subsequent coups in 2020 and 2021.",
    ],
  ],
  // D — Economic Stress
  D: [
    [
      "Argentina",
      2001,
      68.9,
      "currency_crisis",
      "Argentina defaulted on US$100bn of sovereign debt in December 2001, the largest default in history at the time. The peso lost ~75% of its value within months; the country cycled through five presidents in two weeks.",
    ],
    [
      "Lebanon",
      2019,
      66.3,
      "banking_and_financial_crisis",
      "Lebanon's banking system froze deposits in October 2019 as the government defaulted on US$1.2bn in Eurobonds in March 2020. The Beirut port explosion in August 2020 compounded the collapse; GDP contracted ~58% from 2018 to 2021.",
    ],
    [
      "Greece",
      2012,
      64.2,
      "banking_and_financial_crisis",
      "Greece executed the largest sovereign-debt restructuring in history in March 2012 (~€199bn PSI swap). Three EU/IMF bailout programmes ran from 2010 through 2018; unemployment exceeded 27%.",
    ],
  ],
  // E — Social Mobilization
  E: [
    [
      "Egypt",
      2011,
      72.1,
      "mass_protest",
      "Eighteen days of protests centred on Tahrir Square forced President Hosni Mubarak to resign on 11 February 2011. The Supreme Council of the Armed Forces ruled for 16 months; Mohamed Morsi won elections in June 2012 before being deposed in a military coup in July 2013.",
    ],
    [
      "Sudan",
      2019,
      68.4,
      "mass_protest",
      "Mass protests beginning December 2018 against Omar al-Bashir's government led to his removal by the military on 11 April 2019. A transitional Sovereignty Council formed in August 2019; a second coup in October 2021 by General al-Burhan dissolved civilian government.",
    ],
    [
      "Tunisia",
      2010,
      64.7,
      "mass_protest",
      "Mohamed Bouazizi's self-immolation in December 2010 sparked protests that ended Ben Ali's 23-year rule on 14 January 2011. A new constitution was ratified in January 2014. President Kais Saied subsequently suspended parliament in July 2021.",
    ],
  ],
  // G — Humanitarian Crisis
  G: [
    [
      "Yemen",
      2015,
      75.3,
      "humanitarian_crisis",
      "The Saudi-led military intervention in March 2015 triggered a blockade that, combined with active conflict, produced the world's largest humanitarian crisis by 2018: 21 million people food-insecure, over 4 million displaced, cholera outbreak exceeding 2 million cases.",
    ],
    [
      "DR Congo",
      1998,
      69.8,
      "humanitarian_crisis",
      "The Second Congo War (1998–2003) drew in eight African states. An estimated 5 million people died, mostly from disease and famine; 3.4 million were internally displaced by 2002. The conflict fragmented into dozens of armed groups that persist in eastern DRC today.",
    ],
    [
      "Afghanistan",
      2021,
      65.1,
      "humanitarian_crisis",
      "The Taliban's seizure of Kabul on 15 August 2021 triggered the rapid collapse of the US-backed government. Within months 97% of Afghans fell below the poverty line; 24 million faced acute food insecurity and over 3.5 million were internally displaced by early 2022.",
    ],
  ],
  // Default for other families (A, C, F, H)
  DEFAULT_CRISIS: [
    [
      "Tunisia",
      2010,
      71.4,
      "mass_protest",
      "Mohamed Bouazizi's self-immolation in December 2010 sparked protests that ended Ben Ali's 23-year rule on 14 January 2011. A new constitution was ratified in January 2014. President Kais Saied subsequently suspended parliament in July 2021.",
    ],
    [
      "Argentina",
      2001,
      68.9,
      "currency_crisis",
      "Argentina defaulted on US$100bn of sovereign debt in December 2001, the largest default in history at the time. The peso lost ~75% of its value within months; the country cycled through five presidents in two weeks.",
    ],
    [
      "Greece",
      2012,
      64.2,
      "banking_and_financial_crisis",
      "Greece executed the largest sovereign-debt restructuring in history in March 2012 (~€199bn PSI swap). Three EU/IMF bailout programmes ran from 2010 through 2018; unemployment exceeded 27%.",
    ],
  ],
};

const ANALOG_FALLBACKS_STABLE: AnalogTuple[] = [
  [
    "Indonesia",
    2014,
    62.8,
    "democratic_transition",
    "Joko Widodo's July 2014 election as the first Indonesian president from outside the political-military elite consolidated the post-Reformasi democratic transition that began in 1998.",
  ],
  [
    "Brazil",
    2002,
    58.4,
    "government_formation",
    "Luiz Inácio Lula da Silva's October 2002 election victory completed Brazil's first peaceful left-right transfer of power since the 1985 return to democracy.",
  ],
  [
    "Chile",
    2017,
    54.6,
    "constitutional_change",
    "Chile's 2019-2022 constitutional process began after the October 2019 estallido social. The September 2022 plebiscite rejected the draft; a second process produced another rejected draft in December 2023.",
  ],
];

function analogsFor(iso: string, recipesLit: Array<[string, number]>): CountryAnalog[] {
  // 1. Try to pull from Daniyar's nearest-analog corpus.
  const fromCorpus = getCurrentCountry(iso);
  if (fromCorpus && fromCorpus.analogs.length > 0) {
    return fromCorpus.analogs.map((a) => ({
      country: a.country,
      year: a.year,
      match_score: a.match_score,
      primary_recipe_id: a.primary_recipe_id,
      what_happened_next: a.what_happened_next,
      weak_analog: a.weak_analog,
    }));
  }

  // 2. Otherwise fabricate from per-family pools.
  const topScore = recipesLit[0]?.[1] ?? 0;
  if (topScore < 60) {
    // Low-risk countries: use the stable pool, excluding self by country name.
    const filtered = ANALOG_FALLBACKS_STABLE.filter(
      (t) => t[0].toLowerCase() !== iso.toLowerCase()
    );
    return filtered.map((t) => ({
      country: t[0],
      year: t[1],
      match_score: t[2],
      primary_recipe_id: t[3],
      what_happened_next: t[4],
      weak_analog: t[2] < 70,
    }));
  }

  // Look up the top recipe's L1 family id via the tracker.
  const topRecipeId = recipesLit[0]?.[0];
  const topRecipeMeta = topRecipeId ? getRecipe(topRecipeId) : undefined;
  const l1Id = topRecipeMeta?.l1_id ?? "";

  // Pick the family pool, falling back to DEFAULT_CRISIS for unmapped families.
  const familyPool =
    ANALOG_POOLS_BY_FAMILY[l1Id] ?? ANALOG_POOLS_BY_FAMILY.DEFAULT_CRISIS;

  // Subject country name (look up from seeds or fall back to ISO).
  // We use iso as the lookup key; self-exclusion is case-insensitive on the
  // analog's country name field.
  const subjectSeed = SEEDS.find((s) => s.iso === iso.toUpperCase());
  const subjectName = subjectSeed?.name ?? "";

  const filtered = familyPool.filter(
    (t) => t[0].toLowerCase() !== subjectName.toLowerCase()
  );
  return filtered.map((t) => ({
    country: t[0],
    year: t[1],
    match_score: t[2],
    primary_recipe_id: t[3],
    what_happened_next: t[4],
    weak_analog: t[2] < 70,
  }));
}

function compoundScore(litRecipes: Array<[string, number]>): number {
  // Same stacking heuristic as compound-risk-data.ts — sum of top-decile
  // margins above the 50 anchor. Transparent over discrimination ranks.
  return litRecipes.reduce((s, [, score]) => s + Math.max(0, score - 50), 0);
}

// Hydrate a seed into a full CountryV4 entry.
function hydrate(seed: Seed): CountryV4 {
  const topRecipesAll: CountryTopRecipe[] = [];
  for (const [recipeId, score] of seed.recipesLit) {
    const meta: TrackerRecipe | undefined = getRecipe(recipeId);
    if (!meta) continue;
    topRecipesAll.push({
      recipe_id: recipeId,
      label: meta.label,
      score,
      l1_id: meta.l1_id,
      l1_label: meta.l1_label,
      l1_color: meta.l1_color,
      status: meta.status,
    });
  }
  topRecipesAll.sort((a, b) => b.score - a.score);

  const recipesLitCount = topRecipesAll.length;
  const recipesLitGraduated = topRecipesAll.filter(
    (r) => r.status === "graduated"
  ).length;

  // Distinct lit families, A..H order.
  const litFamiliesMap = new Map<string, CountryLitFamily>();
  for (const r of topRecipesAll) {
    if (!litFamiliesMap.has(r.l1_id)) {
      litFamiliesMap.set(r.l1_id, {
        l1_id: r.l1_id,
        l1_label: r.l1_label,
        l1_color: r.l1_color,
      });
    }
  }
  const litFamilies = Array.from(litFamiliesMap.values()).sort((a, b) =>
    a.l1_id.localeCompare(b.l1_id)
  );

  // Movement: same shape as the prior `drivers` field, with `direction`
  // and `z_score_change` lifted from the seed shape signal.
  const drivers_movement: CountryDriverMovement[] = seed.drivers.map((d) => {
    const trajectory = buildTrajectory(d.shape, d.from, d.to, seed.iso, d.code);
    const direction: CountryDriverMovement["direction"] =
      d.shape === "rising" ? "rising" : d.shape === "falling" ? "falling" : "flat";
    return {
      indicator_code: d.code,
      indicator_name: d.name,
      provider: d.provider,
      direction,
      trajectory,
      z_score_change: Number((d.to - d.from).toFixed(1)),
    };
  });

  // Attribution: SHAP-style signal share for the country's TOP-lit recipe.
  // Deterministic decay so different countries get visually distinct
  // distributions while still summing to ~100. R&D reply §Q4 mandates the
  // distinction from movement; both are surfaced separately.
  const topRecipe = topRecipesAll[0];
  const drivers_attribution: CountryDriverAttribution[] = topRecipe
    ? buildAttribution(seed, topRecipe.recipe_id)
    : [];

  // Momentum: top-4 lit recipes get rank-history sparklines.
  const momentum: CountryMomentum[] = topRecipesAll.slice(0, 4).map((r) => ({
    recipe_id: r.recipe_id,
    label: r.label,
    l1_color: r.l1_color,
    rank_history: buildRankHistory(seed.iso, r.recipe_id, r.score),
  }));

  return {
    iso: seed.iso,
    name: seed.name,
    region: seed.region,
    flag_emoji: seed.flag,
    population: seed.population,
    compound_score: compoundScore(seed.recipesLit),
    recipes_lit_count: recipesLitCount,
    recipes_lit_graduated: recipesLitGraduated,
    top_recipes: topRecipesAll,
    drivers_attribution,
    drivers_movement,
    drivers: drivers_movement, // back-compat alias
    momentum,
    analogs: analogsFor(seed.iso, seed.recipesLit),
    lit_families: litFamilies,
    vintage: VINTAGE,
  };
}

/**
 * SHAP-style attribution for a country × top-lit recipe.
 *
 * The pipeline (per R&D reply §Q4) emits per-recipe signal_share_pct for
 * the 4 indicators that define the recipe's canonical shape. We
 * synthesize a plausible distribution here using:
 *   1. The seed's existing `drivers` array (first 4 indicators).
 *   2. A deterministic decay (rank 1 = ~38%, rank 2 = ~27%, rank 3 = ~20%,
 *      rank 4 = ~15%), normalized to sum to 100.
 *   3. Per-country jitter from a small ISO hash so different countries
 *      don't all look identical.
 *
 * Honesty note: SHAP shares are PER-RECIPE — a country's attribution for
 * its #1 lit recipe is different from its #2. The frontend renders only
 * the top-lit recipe's attribution in §3A (the "why this country scores
 * high" panel). The pipeline could emit attribution for additional
 * recipes; we ship only the top-lit one for v1 mockup scope.
 */
function buildAttribution(seed: Seed, recipeId: string): CountryDriverAttribution[] {
  const indicators = seed.drivers.slice(0, 4);
  if (indicators.length === 0) return [];

  // Deterministic per-country jitter — small hash of the ISO modulo a small range.
  const seedHash = seed.iso
    .split("")
    .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 1000, 7);
  const jitter = (idx: number) => ((seedHash + idx * 73) % 11) - 5; // ±5

  // Decay weights for ranks 1..4. Sum = 100.
  const baseWeights = [38, 27, 20, 15];
  const raw = indicators.map((_, i) => baseWeights[i] + jitter(i));
  const total = raw.reduce((a, b) => a + b, 0);
  const normalized = raw.map((w) => Math.round((w / total) * 1000) / 10);
  // Adjust the largest entry so the sum is exactly 100.0 (rounding drift).
  const drift = 100 - normalized.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    normalized[0] = Number((normalized[0] + drift).toFixed(1));
  }

  return indicators.map((d, i) => ({
    indicator_code: d.code,
    indicator_name: d.name,
    provider: d.provider,
    signal_share_pct: normalized[i],
    recipe_id: recipeId,
  }));
}

export const COUNTRIES_V4: CountryV4[] = SEEDS.map(hydrate);

export function getCountryByIso(iso: string): CountryV4 | undefined {
  const upper = iso.toUpperCase();
  return COUNTRIES_V4.find((c) => c.iso === upper);
}

export function countriesByRegion(
  input?: readonly CountryV4[]
): Record<string, CountryV4[]> {
  const src = input ?? COUNTRIES_V4;
  const out: Record<string, CountryV4[]> = {};
  for (const c of src) {
    if (!out[c.region]) out[c.region] = [];
    out[c.region].push(c);
  }
  return out;
}
