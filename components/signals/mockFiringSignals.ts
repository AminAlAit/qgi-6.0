/**
 * MOCK: "5 firing now" — A3 Family 3 brief curated band.
 *
 * Brief: qgi-docs/internal/ops/cycle-resurfacing/merger-brief-2026-05-13.md
 *   §Family 3 / "5 firing now" curated band (paired with Domain activation band per
 *   PR #2 scope; mirrors Countries Family 2 "5 to watch" pattern)
 *
 * Pinned above the 71-row main table as 5 cards with Sipho's
 * `[Editor's pick · week of {date}]` label. Selection criteria per brief:
 * categories that newly crossed an elevated rung OR moved >0.5σ on max
 * salience over the trailing 4 weeks.
 *
 * MOCK for PR #2: hand-selected by editorial. In production these come
 * from a curated JSON file refreshed weekly alongside the V1.9.1 bake.
 * Each entry references a category slug that resolves against the
 * aggregated SignalRow set built in app/(app)/signals/page.tsx.
 */

export interface FiringSignal {
  /** Internal recipe slug — matches SignalRow.category. */
  category: string;
  display_name: string;
  /** Current tier rung; vocab matches SignalTier in page.tsx. */
  tier: "HIGH" | "MODERATE" | "INDICATIVE";
  /** L1 domain short code (POL/CON/GOV/ECO/SOC/DIP/HUM/STR) — see CATEGORY_L1_MAP. */
  l1_code: string;
  /** 2-3 sentence movement summary (Ingrid voice). */
  movement: string;
  /** Top 3 country names for the chip strip; render in arrival order. */
  top_countries: ReadonlyArray<{ name: string; alpha_2: string }>;
}

export const FIRING_SIGNALS: ReadonlyArray<FiringSignal> = [
  {
    category: "civil_war_and_insurgency",
    display_name: "Civil War and Insurgency",
    tier: "HIGH",
    l1_code: "CON",
    movement:
      "Civil war and insurgency remains the highest-aligned pattern across the corpus this week, with renewed displacement pressure in Syria and Sudan elevating max-salience above 2.8σ for the third consecutive month.",
    top_countries: [
      { name: "Syria", alpha_2: "SY" },
      { name: "Sudan", alpha_2: "SD" },
      { name: "Myanmar", alpha_2: "MM" },
    ],
  },
  {
    category: "mass_protest",
    display_name: "Mass Protest",
    tier: "HIGH",
    l1_code: "POL",
    movement:
      "Mass-protest signals strengthened in Q1 2026, driven by Iran's currency-crisis demonstrations and Georgia's post-election movement; the pattern now fires across 14 countries, the broadest distribution since the 2019 cluster.",
    top_countries: [
      { name: "Iran", alpha_2: "IR" },
      { name: "Georgia", alpha_2: "GE" },
      { name: "Argentina", alpha_2: "AR" },
    ],
  },
  {
    category: "political_repression",
    display_name: "Political Repression",
    tier: "HIGH",
    l1_code: "GOV",
    movement:
      "Political repression crossed an elevated threshold in three additional countries this quarter; Venezuela, Belarus, and Nicaragua continue to anchor the high end while Iran's escalation is the largest single-country move.",
    top_countries: [
      { name: "Venezuela", alpha_2: "VE" },
      { name: "Iran", alpha_2: "IR" },
      { name: "Belarus", alpha_2: "BY" },
    ],
  },
  {
    category: "humanitarian_crisis",
    display_name: "Humanitarian Crisis",
    tier: "HIGH",
    l1_code: "HUM",
    movement:
      "Humanitarian-crisis indicators tightened across the Sahel and Levant; the pattern's spread widened from 9 to 12 firing countries since the December snapshot, with food-access stress the dominant driver.",
    top_countries: [
      { name: "Syria", alpha_2: "SY" },
      { name: "Yemen", alpha_2: "YE" },
      { name: "Sudan", alpha_2: "SD" },
    ],
  },
  {
    category: "currency_crisis",
    display_name: "Currency Crisis",
    tier: "MODERATE",
    l1_code: "ECO",
    movement:
      "Currency-crisis alignment moved from indicative to moderate in five emerging markets this quarter; Turkey, Egypt, and Pakistan now share a similar fiscal-distress signature to historical 1997-class precedents.",
    top_countries: [
      { name: "Turkey", alpha_2: "TR" },
      { name: "Egypt", alpha_2: "EG" },
      { name: "Pakistan", alpha_2: "PK" },
    ],
  },
];
