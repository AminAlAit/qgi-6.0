import type { Step } from "react-joyride";

/**
 * QGI in-product tour — 44 steps across 14 pages.
 *
 * Original 12 steps authored from the 5-persona convergence walkthrough
 * (Aisha/Karl/Mei-Lin/Helena/Roberto) on production qgintelligence.com,
 * 2026-05-18. See
 * `qgi-docs/internal/testing/tour-design/tour-spec-convergence-2026-05-18.md`
 * for the synthesis and per-persona walkthroughs.
 *
 * V4.1 extension: 32 steps across 9 new routes (dashboard-v4.1,
 * recipes-v4.1, recipes-v4.1/foreign_intervention, countries-v4.1,
 * countries-v4.1/sdn, risk-board, compound-risk, nearest-analog,
 * recipe-tracker). Authored from Hana K-B's V4.1 tour spec, 2026-05-28.
 *
 * Every page has a mandatory **(a) Introduction** step anchored on the page's
 * `h1`. Additional **(d) "What to be careful of"** steps anchor on the
 * methodology disclosure callouts (now always-visible per PR-A). Some
 * pages add **(b) Navigation** or **(c) Workflow** steps where 3+ personas
 * converged on a high-leverage affordance.
 *
 * Total: 44 steps, page-resumed by the TourProvider — visiting another
 * page mid-tour picks up at that page's first remaining step.
 */

export interface QgiTourStep extends Step {
  /** Which page route this step is anchored on. Used by the provider to
   *  segment the tour by route + resume on navigation. */
  page:
    | "/dashboard"
    | "/precedents"
    | "/patterns"
    | "/signals"
    | "/countries"
    | "/dashboard-v4.1"
    | "/recipes-v4.1"
    | "/recipes-v4.1/foreign_intervention"
    | "/countries-v4.1"
    | "/countries-v4.1/sdn"
    | "/risk-board"
    | "/compound-risk"
    | "/nearest-analog"
    | "/recipe-tracker";
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
    title: "Countries — the in-scope roster",
    content:
      "QGI scopes 214 countries; the count actually scored each cycle varies as data coverage shifts. Unscored countries are not excluded, just data-sparse. Tiers (HIGH / MODERATE / INDICATIVE) reflect relative position in this cycle's panel. It is not a probability of a specific event in a specific year.",
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

  // ─── /dashboard-v4.1 — 4 steps ───────────────────────────────────────────
  {
    page: "/dashboard-v4.1",
    dimension: "a",
    target: "h1",
    title: "Start with the thesis",
    content:
      "QG Intelligence describes country risk by comparing today against history. Every number on this site is a resemblance score: how strongly a country's recent trajectory matches a validated historical pattern. Nothing here is a forecast of a specific event in a specific year.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/dashboard-v4.1",
    dimension: "b",
    target: '[data-tour="hero-tiles"]',
    title: "Six numbers that summarize the program",
    content:
      "These tiles are not predictions. They are program-state counts: how many recipes have cleared every validation checkpoint, how many were tested and did not hold up, how many are still being tested.",
    placement: "bottom",
  },
  {
    page: "/dashboard-v4.1",
    dimension: "c",
    target: '[data-tour="highlights-band"]',
    title: "Where today's signal is loudest",
    content:
      "Four tiles, one from each of the live surfaces, refreshed each data vintage. Tap any tile to open the full page behind it. You will meet each of those surfaces in turn as the tour continues.",
    placement: "bottom",
  },
  {
    page: "/dashboard-v4.1",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "Open this when you forget",
    content:
      "Every page has this button. It opens a quiet reference card with the four ground rules: scores are ranks not probabilities, counts come from the tracker, corrections are published on purpose, nothing here is a forecast. Re-open it on any page to re-anchor.",
    placement: "bottom",
  },

  // ─── /recipes-v4.1 — 3 steps ─────────────────────────────────────────────
  {
    page: "/recipes-v4.1",
    dimension: "a",
    target: "h1",
    title: "The catalog of patterns",
    content:
      "A recipe is a pre-registered shape: a small set of indicators (typically three to five) whose trajectory tends to rise or fall together in the years before a particular kind of event. The catalog is grouped by family.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/recipes-v4.1",
    dimension: "b",
    target: '[data-tour="family-section-A"] header',
    title: "Eight families, by event kind",
    content:
      "Families group recipes by what kind of rupture they describe: conflict and violence, governance breakdown, economic crisis, and so on. The color on each card is the family color, kept consistent everywhere on the site.",
    placement: "top",
  },
  {
    page: "/recipes-v4.1",
    dimension: "d",
    target: 'a[href="/recipes-v4.1/foreign_intervention"]',
    title: "Pick one to see how deep it goes",
    content:
      "We will open foreign_intervention next. It is the demo recipe: it was withdrawn for re-evaluation after an audit found a coverage gap, and the page carries that note transparently. That is the methodology working as designed.",
    placement: "right",
  },

  // ─── /recipes-v4.1/foreign_intervention — 5 steps ────────────────────────
  {
    page: "/recipes-v4.1/foreign_intervention",
    dimension: "a",
    target: "h1",
    title: "One recipe, laid bare",
    content:
      "A recipe is a pre-registered shape, validated against curated historical events. The page is organized in four blocks: structure (what the recipe is made of), validation (how well it works), results (which countries currently resemble it), and deep-dive (the anatomy behind a single match).",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/recipes-v4.1/foreign_intervention",
    dimension: "b",
    target: 'section[id="cap-2"]',
    title: "Indicator set: the recipe's ingredients",
    content:
      "Each recipe is a small set of indicators whose canonical movement shape defines it. The weights sum to 100% across the set: a higher weight means the indicator pulled more of its weight in distinguishing pre-event years from non-event ones.",
    placement: "right",
  },
  {
    page: "/recipes-v4.1/foreign_intervention",
    dimension: "c",
    target: '[data-tour="discrimination-panel"]',
    title: "How well the recipe separates",
    content:
      "The discrimination score reports how well the recipe separates pre-event years from non-event years on countries it never trained on. Higher means a cleaner separation: it does not mean any single country will experience the event.",
    placement: "right",
  },
  {
    page: "/recipes-v4.1/foreign_intervention",
    dimension: "c",
    target: '[data-tour="countries-panel"]',
    title: "Today's resemblance, ranked",
    content:
      "These are the countries whose recent trajectory most resembles the recipe today. Read it as a leaderboard of resemblance, not a watchlist of risk. The same shape appears as a row on the Live Risk Board you will see in a few steps.",
    placement: "top",
  },
  {
    page: "/recipes-v4.1/foreign_intervention",
    dimension: "d",
    target: '[data-tour="demo-disclosure"]',
    title: "Why we still show the page",
    content:
      "This recipe's graduation was withdrawn after an audit found a coverage gap. We render the page populated so you can see what a deployed recipe looks like, with the withdrawal disclosed in line. The live status lives on the Recipe Tracker.",
    placement: "bottom",
  },

  // ─── /countries-v4.1 — 3 steps ───────────────────────────────────────────
  {
    page: "/countries-v4.1",
    dimension: "a",
    target: "h1",
    title: "The same data, pivoted",
    content:
      "If a recipe is the pattern, a country is the body the pattern shows up on. This atlas asks: of every country we track, which recipes does it currently resemble? Each card is a small dossier; tap it for the full country view.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/countries-v4.1",
    dimension: "c",
    target: '[data-tour="cotw-tile"]',
    title: "Country of the week",
    content:
      "The country whose stack of resembled recipes is most worth a careful read this vintage. Sort and region filters above let you slice the full atlas; the colored border on each card is the family with the strongest match for that country.",
    placement: "left",
  },
  {
    page: "/countries-v4.1",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "Same rules apply",
    content:
      "Scores on this page are still ranks of resemblance, not probabilities. A country lit on three recipes is not three times more likely to break: it is a country whose current trajectory rhymes with three distinct historical patterns.",
    placement: "bottom",
  },

  // ─── /countries-v4.1/sdn — 4 steps ───────────────────────────────────────
  {
    page: "/countries-v4.1/sdn",
    dimension: "a",
    target: "h1",
    title: "One country, in full",
    content:
      "What the platform currently says about Sudan, in plain language. The lede tells you how many recipes this country is lit on, across how many families, and reminds you that none of these recipes is deployed for real decisions. Resemblance, not prediction.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/countries-v4.1/sdn",
    dimension: "b",
    target: '[data-tour="lit-recipes-panel"]',
    title: "Lit recipes, scored and chipped",
    content:
      "Every recipe Sudan currently resembles, scored on the same 0 to 100 rank. The status chip on the right says whether that recipe has been deployed, was tested and did not hold up, is in review, or is still queued.",
    placement: "top",
  },
  {
    page: "/countries-v4.1/sdn",
    dimension: "c",
    target: '[data-tour="drivers-panels"]',
    title: "Why and what's moving",
    content:
      "The two panels here split the question. 'Why' shows which indicators contributed most to the top resemblance score. 'What's moving' shows which indicators have shifted most lately. Together they answer: where did the score come from, and where is it heading.",
    placement: "top",
  },
  {
    page: "/countries-v4.1/sdn",
    dimension: "d",
    target: '[data-tour="how-to-read-panel"]',
    title: "The four rules, one click away",
    content:
      "This panel is the reference card you will see open from the button on every other page. It is permanent on country pages because the country view is the one most often deep-linked and shared, so the rules ride with the page.",
    placement: "top",
  },

  // ─── /risk-board — 3 steps ───────────────────────────────────────────────
  {
    page: "/risk-board",
    dimension: "a",
    target: "h1",
    title: "Today, in one leaderboard",
    content:
      "Which countries currently resemble a validated crisis shape, ranked across every recipe in the catalog. Each cell is one country, on one recipe, today. Click any cell to open that recipe's report card.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/risk-board",
    dimension: "c",
    target: '[data-tour="risk-board-hero-strip"]',
    title: "The top pairs, across every recipe",
    content:
      "These are the highest-resemblance country and recipe pairs anywhere on the platform, this vintage. The arrow tells you how that pair has shifted since last quarter: movement is a rank shift, not a probability change.",
    placement: "bottom",
  },
  {
    page: "/risk-board",
    dimension: "d",
    target: '[data-tour="risk-board-honesty"]',
    title: "Read scores as ranks, every time",
    content:
      "A country at 80 is not 80 percent likely to break. It is sitting high in the distribution of countries whose recent trajectory resembles this recipe. Hold that distinction in mind on every page that follows.",
    placement: "bottom",
  },

  // ─── /compound-risk — 3 steps ────────────────────────────────────────────
  {
    page: "/compound-risk",
    dimension: "a",
    target: "h1",
    title: "Countries lit on more than one recipe",
    content:
      "Some countries resemble several recipes at once. This page surfaces them, ranked by a stacking score that combines high rankings across each lit recipe. It answers: where are structural pressures piling up on the same state?",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/compound-risk",
    dimension: "c",
    target: '[data-tour="compound-leaderboard"]',
    title: "Stacked rank, not joint probability",
    content:
      "A country lit on three recipes is not three times more likely to break. It is a country whose trajectory rhymes with three distinct patterns at once. The compound score stacks resemblance ranks across recipes; it does not multiply event probabilities.",
    placement: "top",
  },
  {
    page: "/compound-risk",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "The four rules, again",
    content:
      "This page is the most common place to misread a score. Open the rules on the way in. With limited deployed recipes in the catalog today, the compound view is illustrative; it becomes meaningful as more recipes pass validation.",
    placement: "bottom",
  },

  // ─── /nearest-analog — 3 steps ───────────────────────────────────────────
  {
    page: "/nearest-analog",
    dimension: "a",
    target: "h1",
    title: "Today's shape, in history",
    content:
      "Pick a country today, the engine shows you the closest historical match. Pure shape-matching across the recipe library. A similarity statement, never a forecast of what happens next.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/nearest-analog",
    dimension: "c",
    target: '[data-tour="picker-panel"]',
    title: "Pick a country, see its rhyme",
    content:
      "Search for any country in the corpus. The page returns its three closest historical analogs, with what happened to those analog countries listed for context. That history is a fact about the analog, not a prediction about today's country.",
    placement: "right",
  },
  {
    page: "/nearest-analog",
    dimension: "d",
    target: '[data-tour="analog-methodology-box"]',
    title: "Resemblance, never forecast",
    content:
      "If you read one statement on this site, read this panel's four. Analog matches are similarities, not forward predictions: today's Egypt looking like 2008 Tunisia means the trajectories rhyme, not that Egypt will follow Tunisia.",
    placement: "left",
  },

  // ─── /recipe-tracker — 4 steps ───────────────────────────────────────────
  {
    page: "/recipe-tracker",
    dimension: "a",
    target: "h1",
    title: "Where every claim resolves",
    content:
      "Every recipe in the catalog has a status: deployed, tested-and-did-not-hold-up, in review, early-method-under-review, or not yet tested. This page is the scoreboard. The other eight pages cite it; this page is the source of truth.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/recipe-tracker",
    dimension: "b",
    target: '[data-tour="tracker-hero-tiles"]',
    title: "Six tiles, summing to the whole program",
    content:
      "The big green tile counts the deployed recipes. The amber tile counts the ones tested that did not hold up. Most recipes do not hold up: the tracker showing that clearly is the integrity signal, not a sign of failure.",
    placement: "bottom",
  },
  {
    page: "/recipe-tracker",
    dimension: "c",
    target: '[data-tour="vacate-log"]',
    title: "Corrections are published on purpose",
    content:
      "When a prior result does not survive audit, we withdraw it publicly and log the reason here. Reading the log is reading the methodology working as designed.",
    placement: "left",
  },
  {
    page: "/recipe-tracker",
    dimension: "d",
    target: '[data-tour="read-this-panel"]',
    title: "Four lines that ride every page",
    content:
      "These four statements are the substrate. Every page on the site lives or dies by them: scores are resemblance ranks not probabilities; deployed means cleared every checkpoint; corrections are published on purpose; most recipes do not hold up. You have finished the tour.",
    placement: "left",
  },
];

/** Step count by page — used by the TourProvider for "Step N of M" display. */
export const TOUR_STEPS_BY_PAGE: Readonly<Record<QgiTourStep["page"], number>> =
  TOUR_STEPS.reduce<Record<string, number>>((acc, s) => {
    acc[s.page] = (acc[s.page] ?? 0) + 1;
    return acc;
  }, {}) as Readonly<Record<QgiTourStep["page"], number>>;

export const TOUR_TOTAL_STEPS = TOUR_STEPS.length;
