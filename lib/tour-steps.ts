import type { Step } from "react-joyride";

/**
 * QGI in-product tour — 12 steps across 5 pages.
 *
 * Authored from the 5-persona convergence walkthrough (Aisha/Karl/Mei-Lin/
 * Helena/Roberto) on production qgintelligence.com, 2026-05-18. See
 * `qgi-docs/internal/testing/tour-design/tour-spec-convergence-2026-05-18.md`
 * for the synthesis and per-persona walkthroughs.
 *
 * Every page has a mandatory **(a) Introduction** step anchored on the page's
 * `h1`. Additional **(d) "What to be careful of"** steps anchor on the
 * methodology disclosure callouts (now always-visible per PR-A). Some
 * pages add **(b) Navigation** or **(c) Workflow** steps where 3+ personas
 * converged on a high-leverage affordance.
 *
 * Total: 12 steps, page-resumed by the TourProvider — visiting another
 * page mid-tour picks up at that page's first remaining step.
 */

export interface QgiTourStep extends Step {
  /** Which page route this step is anchored on. Used by the provider to
   *  segment the tour by route + resume on navigation. */
  page: "/dashboard" | "/precedents" | "/patterns" | "/signals" | "/countries";
  /** Tour-design dimension covered (a/b/c/d) per the spec. */
  dimension: "a" | "b" | "c" | "d";
}

export const TOUR_STEPS: ReadonlyArray<QgiTourStep> = [
  // ─── /dashboard — 2 steps ───────────────────────────────────────────
  {
    page: "/dashboard",
    dimension: "a",
    target: "h1",
    title: "Dashboard — the synthesis layer",
    content:
      "The dashboard surfaces tier distribution, the watchlist, and current-cycle convergences from all four family surfaces. It does not produce its own metrics; it summarises. Check the cycle metadata before citing anything time-sensitive.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/dashboard",
    dimension: "d",
    target: 'aside[role="note"][aria-label="Methodology note"]',
    title: "Read this before citing",
    content:
      "A HIGH count aggregates four methodologically distinct surfaces — country tier ≠ signal tier ≠ recipe tier ≠ pattern tier. Stale data in a fast-moving region is a citation liability.",
    placement: "bottom",
  },

  // ─── /precedents — 3 steps ──────────────────────────────────────────
  {
    page: "/precedents",
    dimension: "a",
    target: "h1",
    title: "Precedents — the certified evidence layer",
    content:
      "A precedent is a recipe — a recurring instability event type. 13 are in the locked catalogue; only 4 have completed ML adjudication. The table tier (STRONG/MODERATE) reflects ML-validated predictive strength of those 4 — not overall risk magnitude.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/precedents",
    dimension: "d",
    target: 'aside[role="note"][aria-label="How to read this"]',
    title: "Only 4 of 13 are validated",
    content:
      "If you cite a recipe finding, check whether it's one of the four. The other 9 are locked but not adjudicated — citing them requires an explicit disclosure sentence. 'Not validated' ≠ 'no risk' — read it as 'evidence still under audit.'",
    placement: "bottom",
  },
  {
    page: "/precedents",
    dimension: "b",
    target: "table",
    title: "Tier and Coverage columns",
    content:
      "TIER here (STRONG/MODERATE) is the ML evidence strength — NOT the same as HIGH/MODERATE/INDICATIVE on /countries. The COVERAGE column tells you whose history trained the model — '25% OECD' means ~53 OECD countries; check your country's region before citing.",
    placement: "top",
  },

  // ─── /patterns — 3 steps (the highest-leverage tour) ────────────────
  {
    page: "/patterns",
    dimension: "a",
    target: "h1",
    title: "Patterns — structural analogues",
    content:
      "A Pattern is a country pair whose indicator trajectories ran near-parallel over a multi-decade window. Paraguay→South Korea, 64 years, 91% correlation. Each row is a dated instance, not a unique pair. This is a structural analogue, not a forecast.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/patterns",
    dimension: "d",
    target: 'div[aria-label="Methodology disclosure"]',
    title: "Six tier systems on one page",
    content:
      "This page runs 6 distinct tier/badge systems: Pattern strength (composite ranking, not a probability), Correlation tier (S/A/B/C), Window tier (S/M/L/XL-win), Evidence strength, Recipe Confidence Index, Country tier. Hover any badge before quoting any number.",
    placement: "bottom",
  },
  {
    page: "/patterns",
    dimension: "c",
    target: 'button[aria-pressed="false"]',
    title: "Workflow: start with 'Currently firing'",
    content:
      "Hit a quick preset first — 'Currently firing' filters to patterns where today's signal activity matches the historical trajectory. Then search by your country in the COUNTRY facet, and sort by Correlation for the cleanest analogue.",
    placement: "bottom",
  },

  // ─── /signals — 2 steps (domain-filter (b) was 2/5 convergence, deferred
  //     as segment-targeted optional per the founder-locked SHIP threshold) ──
  {
    page: "/signals",
    dimension: "a",
    target: "h1",
    title: "Signals — 67 risk categories",
    content:
      "Each row is a category and the maximum salience-z across all firing countries. Tier here is a σ-threshold rung (HIGH ≥ 2.5σ, MODERATE ≥ 1.0σ relative to the current-cycle panel) — not a probability, and not the same as country tier on /countries.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/signals",
    dimension: "d",
    target: 'div[aria-label="Methodology disclosure"]',
    title: "σ-distance, not probability",
    content:
      "Tier values here use σ-distance from the panel baseline — not exceedance probabilities. Treat tier as a ranked ordinal screen, not a return-period estimate. Where 'Preview' badges appear (e.g., the Alignment column), those numbers are placeholders pending the next bake.",
    placement: "bottom",
  },

  // ─── /countries — 2 steps (with optional 3rd) ───────────────────────
  {
    page: "/countries",
    dimension: "a",
    target: "h1",
    title: "Countries — the 156-country roster",
    content:
      "156 of 214 countries currently have a risk tier. The 58 remaining are in-scope but unscored — data sparsity, not exclusion. Tiers (HIGH / MODERATE / INDICATIVE) reflect relative position in this cycle's panel. It is not a probability of a specific event in a specific year.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/countries",
    dimension: "d",
    target: '[role="note"][aria-label="What tier does not mean"]',
    title: "What tier does not mean",
    content:
      "Single most important disclosure for citation use. Tier is a relative distributional rank — it does not imply a probability of loss, a return period, or a credit-event forecast. Pakistan at HIGH and Somalia at HIGH are not equiprobable risks; salience score and recipe count differentiate them.",
    placement: "bottom",
  },
];

/** Step count by page — used by the TourProvider for "Step N of M" display. */
export const TOUR_STEPS_BY_PAGE: Readonly<Record<QgiTourStep["page"], number>> =
  TOUR_STEPS.reduce<Record<string, number>>((acc, s) => {
    acc[s.page] = (acc[s.page] ?? 0) + 1;
    return acc;
  }, {}) as Readonly<Record<QgiTourStep["page"], number>>;

export const TOUR_TOTAL_STEPS = TOUR_STEPS.length;
