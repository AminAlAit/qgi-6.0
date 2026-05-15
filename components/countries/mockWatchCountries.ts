/**
 * MOCK: "5 countries to watch this week" — A3 Family 2 brief curated band.
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   §Family 2 / "5 countries to watch" curated band
 *
 * Pinned above the 156-row main table as 5 sticky rows with Sipho's
 * `[Editor's pick · week of {date}]` label. Selection criteria per brief:
 * tier change this quarter OR driving-category z-score moved >0.5.
 *
 * MOCK for PR #2: hand-selected by editorial. In production these come
 * from a curated JSON file refreshed weekly (qgi-data follow-up).
 * Each entry references a country slug that resolves against country-risks.json.
 */

export interface WatchCountry {
  /** ISO slug matching countrySlug(country.name) output. */
  slug: string;
  display_name: string;
  alpha_2: string;
  current_tier: "HIGH" | "MODERATE" | "INDICATIVE";
  /** Null if tier didn't change this quarter; otherwise the previous tier. */
  previous_tier: "HIGH" | "MODERATE" | "INDICATIVE" | null;
  /** 2-3 sentence movement summary (Ingrid voice). */
  movement: string;
  /** Driving category slugs — rendered as chips beside the entry. */
  driving_categories: string[];
  /** MOCK: ML coverage count out of 13 LOCKed recipes (PR #4.5 pattern;
   *  upgrades to real when ml-recipe-stack per-country AHI bake lands). */
  ml_coverage: number;
}

export const WATCH_COUNTRIES: ReadonlyArray<WatchCountry> = [
  {
    slug: "syria",
    display_name: "Syria",
    alpha_2: "SY",
    current_tier: "HIGH",
    previous_tier: "HIGH",
    movement:
      "Syria remains HIGH following the collapse of Idlib ceasefire talks; civil-conflict indicators show renewed displacement pressure in Q1 2026.",
    driving_categories: [
      "civil_war_and_insurgency",
      "humanitarian_crisis",
      "foreign_intervention",
    ],
    ml_coverage: 4,
  },
  {
    slug: "iran",
    display_name: "Iran",
    alpha_2: "IR",
    current_tier: "HIGH",
    previous_tier: "MODERATE",
    movement:
      "Iran moved from MODERATE to HIGH this quarter, driven by a sharp rise in political repression signals and elevated mass protest activity following the currency crisis.",
    driving_categories: ["mass_protest", "political_repression", "fiscal_policy_change"],
    ml_coverage: 3,
  },
  {
    slug: "venezuela",
    display_name: "Venezuela",
    alpha_2: "VE",
    current_tier: "HIGH",
    previous_tier: "HIGH",
    movement:
      "Venezuela remains HIGH; the humanitarian crisis dimension strengthened as the government's food-distribution controls tightened in late 2025.",
    driving_categories: [
      "humanitarian_crisis",
      "political_repression",
      "elections_and_voting",
    ],
    ml_coverage: 2,
  },
  {
    slug: "germany",
    display_name: "Germany",
    alpha_2: "DE",
    current_tier: "MODERATE",
    previous_tier: "INDICATIVE",
    movement:
      "Germany moved from INDICATIVE to MODERATE following a period of elevated elections-and-voting activity; the AfD's 2025 coalition entry raised constitutional-change signals.",
    driving_categories: [
      "elections_and_voting",
      "constitutional_change",
      "government_formation",
    ],
    ml_coverage: 1,
  },
  {
    slug: "georgia",
    display_name: "Georgia",
    alpha_2: "GE",
    current_tier: "MODERATE",
    previous_tier: "INDICATIVE",
    movement:
      "Georgia moved from INDICATIVE to MODERATE; bilateral-treaty activity with the EU accelerated while domestic mass-protest signals remained elevated after the disputed 2024 election.",
    driving_categories: ["bilateral_treaty", "mass_protest", "elections_and_voting"],
    ml_coverage: 1,
  },
];
