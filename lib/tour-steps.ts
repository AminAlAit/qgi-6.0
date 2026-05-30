import type { Step } from "react-joyride";

/**
 * QGI in-product tour — 60 steps across 12 canonical pages.
 *
 * Original 12 legacy steps (for /dashboard V3, /precedents, /patterns V3,
 * /signals, /countries V3) removed 2026-05-28 as part of the V4.1
 * canonical promotion — those routes are deleted; the steps would target
 * dead anchors. The 60 remaining V4.1 steps (authored by Hana
 * Kawai-Bjornsson 2026-05-28) cover every visible panel on each of 9
 * canonical surfaces. Arc: "Resemblance, not prediction."
 *
 * Every page has a mandatory **(a) Introduction** step anchored on the
 * page's `h1`. Additional **(d) "What to be careful of"** steps anchor on
 * methodology disclosure callouts. Some pages add **(b) Navigation** or
 * **(c) Workflow** steps where 3+ personas converged on a high-leverage
 * affordance.
 *
 * Total: 60 steps, page-resumed by the TourProvider — visiting another
 * page mid-tour picks up at that page's first remaining step.
 */

export interface QgiTourStep extends Step {
  /** Which page route this step is anchored on. Used by the provider to
   *  segment the tour by route + resume on navigation. */
  page:
    | "/dashboard"
    | "/recipes"
    | "/recipes/foreign_intervention"
    | "/countries"
    | "/countries/sdn"
    | "/risk-board"
    | "/analogues"
    | "/compare"
    | "/patterns"
    | "/patterns/paraguay-south_korea-1963";
  /** Tour-design dimension covered (a/b/c/d) per the spec. */
  dimension: "a" | "b" | "c" | "d";
}

export const TOUR_STEPS: ReadonlyArray<QgiTourStep> = [
  // ─── /dashboard — 6 steps, ordered top-to-bottom ────────────────────
  {
    page: "/dashboard",
    dimension: "a",
    target: "h1",
    title: "Start with the thesis",
    content:
      "QG Intelligence describes country risk by comparing today against history. Every number on this site is a resemblance score: how strongly a country's recent trajectory matches a validated historical pattern. Nothing here is a forecast of a specific event in a specific year.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/dashboard",
    dimension: "b",
    target: '[data-tour="hero-tiles"]',
    title: "Six numbers that summarize the program",
    content:
      "These tiles are not predictions. They are program-state counts: how many recipes have cleared every validation checkpoint, how many were tested and did not hold up, how many are still being tested.",
    placement: "bottom",
  },
  {
    page: "/dashboard",
    dimension: "c",
    target: '[data-tour="highlights-band"]',
    title: "Where today's signal is loudest",
    content:
      "Four tiles, one from each of the live surfaces, refreshed each data vintage. Tap any tile to open the full page behind it. You will meet each of those surfaces in turn as the tour continues.",
    placement: "bottom",
  },
  {
    page: "/dashboard",
    dimension: "b",
    target: '[data-tour="surfaces-grid"]',
    title: "Six pages, six lenses",
    content:
      "Every page on the platform is one of these tiles, and the tour will walk you through each in turn. Recipe Tracker on the left is the source of truth; the other five are different ways of looking at the same data. Tap any tile to jump.",
    placement: "top",
  },
  {
    page: "/dashboard",
    dimension: "c",
    target: '[data-tour="activity-timeline"]',
    title: "Recent activity, in plain log form",
    content:
      "Every validation run, every published correction, every methodology amendment lands here in date order. The expand button reveals the full feed. A correction in this list is the program working as designed, not a defect.",
    placement: "top",
  },
  {
    page: "/dashboard",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "Open this when you forget",
    content:
      "Every page has this button. It opens a quiet reference card with the four ground rules: scores are ranks not probabilities, counts come from the tracker, corrections are published on purpose, nothing here is a forecast. Re-open it on any page to re-anchor.",
    placement: "bottom",
  },

  // ─── /recipes — 3 steps ─────────────────────────────────────────────
  {
    page: "/recipes",
    dimension: "a",
    target: "h1",
    title: "The catalog of patterns",
    content:
      "A recipe is a pre-registered shape: a small set of indicators (typically three to five) whose trajectory tends to rise or fall together in the years before a particular kind of event. The catalog is grouped by family.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/recipes",
    dimension: "b",
    target: '[data-tour="family-section-A"] header',
    title: "Eight families, by event kind",
    content:
      "Families group recipes by what kind of rupture they describe: conflict and violence, governance breakdown, economic crisis, and so on. The color on each card is the family color, kept consistent everywhere on the site.",
    placement: "top",
  },
  {
    page: "/recipes",
    dimension: "d",
    target: 'a[href="/recipes/foreign_intervention"]',
    title: "Pick one to see how deep it goes",
    content:
      "We will open foreign_intervention next. It is the demo recipe: it was withdrawn for re-evaluation after an audit found a coverage gap, and the page carries that note transparently. That is the methodology working as designed.",
    placement: "right",
  },
  {
    page: "/recipes",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "Open this when you forget",
    content:
      "Every page has this button. It opens a quiet reference card with the four ground rules: scores are ranks not probabilities, counts come from the tracker, corrections are published on purpose, nothing here is a forecast.",
    placement: "bottom",
  },

  // ─── /recipes/foreign_intervention — 13 steps, top-to-bottom ────────
  // Reading arc: Header (h1 + demo disclosure) → Structure (Identity, Indicator
  // Set, Window) → Validation (Discrimination, Reliability, Calibration) →
  // Results (Countries, Score Distribution) → Deep-dive (Precedents, Pattern
  // Alignment). The demo-disclosure moves from closing beat to second step
  // because it visually sits in the header band, right under h1.
  {
    page: "/recipes/foreign_intervention",
    dimension: "a",
    target: "h1",
    title: "One recipe, laid bare",
    content:
      "A recipe is a pre-registered shape, validated against curated historical events. The page is organized in four blocks: structure (what the recipe is made of), validation (how well it works), results (which countries currently resemble it), and deep-dive (the anatomy behind a single match).",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/recipes/foreign_intervention",
    dimension: "c",
    target: '[data-tour="demo-disclosure"]',
    title: "Why we still show the page",
    content:
      "This recipe's graduation was withdrawn after an audit found a coverage gap. We render the page populated so you can see what a deployed recipe looks like, with the withdrawal disclosed in line. The live status lives on the Recipe Tracker.",
    placement: "bottom",
  },
  {
    page: "/recipes/foreign_intervention",
    dimension: "a",
    target: '[data-tour="identity-card-panel"]',
    title: "Identity, in one card",
    content:
      "Who this recipe is in one block: the family it belongs to, the events it was trained against, the number of historical cases in its evidence base. Read this first; the rest of the page is its anatomy.",
    placement: "right",
  },
  {
    page: "/recipes/foreign_intervention",
    dimension: "b",
    target: 'section[id="cap-2"]',
    title: "Indicator set: the recipe's ingredients",
    content:
      "Each recipe is a small set of indicators whose canonical movement shape defines it. The weights sum to 100% across the set: a higher weight means the indicator pulled more of its weight in distinguishing pre-event years from non-event ones.",
    placement: "right",
  },
  {
    page: "/recipes/foreign_intervention",
    dimension: "a",
    target: '[data-tour="window-panel"]',
    title: "How far back the shape looks",
    content:
      "Each recipe's canonical movement shape spans a fixed window of years before the event. This number is the recipe's memory horizon: how much past trajectory it considers when matching today's countries.",
    placement: "right",
  },
  {
    page: "/recipes/foreign_intervention",
    dimension: "c",
    target: '[data-tour="discrimination-panel"]',
    title: "How well the recipe separates",
    content:
      "The discrimination score reports how well the recipe separates pre-event years from non-event years on countries it never trained on. Higher means a cleaner separation: it does not mean any single country will experience the event.",
    placement: "right",
  },
  {
    page: "/recipes/foreign_intervention",
    dimension: "c",
    target: '[data-tour="reliability-panel"]',
    title: "Does it hold up across passes",
    content:
      "Discrimination on one validation pass can be a coincidence. Reliability asks whether the result repeats across multiple passes on the same evidence base. This panel says whether the verdict survived the second look.",
    placement: "right",
  },
  {
    page: "/recipes/foreign_intervention",
    dimension: "c",
    target: '[data-tour="calibration-panel"]',
    title: "Calibration, separately tracked",
    content:
      "Discrimination tells you whether the recipe separates pre-event from non-event years. Calibration is a different question: whether the score it assigns means what it claims to mean. Tracked separately because they fail differently.",
    placement: "right",
  },
  {
    page: "/recipes/foreign_intervention",
    dimension: "c",
    target: '[data-tour="countries-panel"]',
    title: "Today's resemblance, ranked",
    content:
      "These are the countries whose recent trajectory most resembles the recipe today. Read it as a leaderboard of resemblance, not a watchlist of risk. The same shape appears as a row on the Live Risk Board you will see in a few steps.",
    placement: "top",
  },
  {
    page: "/recipes/foreign_intervention",
    dimension: "c",
    target: '[data-tour="score-distribution-panel"]',
    title: "Where today's countries fall",
    content:
      "The histogram of every country's score on this recipe today. The top countries you saw a panel up sit in the right tail; most countries cluster around the middle. The shape of the curve tells you whether the recipe is decisive or ambiguous.",
    placement: "top",
  },
  {
    page: "/recipes/foreign_intervention",
    dimension: "c",
    target: '[data-tour="precedents-timeline-panel"]',
    title: "The cases this recipe was trained on",
    content:
      "Every event in the curated record that this recipe was validated against, in date order. Click any to read the case brief. This is the historical evidence base; nothing else on the page would exist without it.",
    placement: "top",
  },
  {
    page: "/recipes/foreign_intervention",
    dimension: "c",
    target: '[data-tour="pattern-alignment-panel"]',
    title: "The shape, indicator by indicator",
    content:
      "The canonical movement shape spelled out: for each indicator in the recipe, the mean trajectory of validated positives in the years leading to the event, with a band showing the 25th to 75th percentile. This is what 'looks like' looks like.",
    placement: "top",
  },
  {
    page: "/recipes/foreign_intervention",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "Open this when you forget",
    content:
      "Every page has this button. It opens a quiet reference card with the four ground rules. Re-open it on any page to re-anchor.",
    placement: "bottom",
  },

  // ─── /countries — 5 steps, ordered top-to-bottom ────────────────────
  {
    page: "/countries",
    dimension: "a",
    target: "h1",
    title: "The same data, pivoted",
    content:
      "If a recipe is the pattern, a country is the body the pattern shows up on. This atlas asks: of every country we track, which recipes does it currently resemble? Each card is a small dossier; tap it for the full country view.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/countries",
    dimension: "c",
    target: '[data-tour="cotw-tile"]',
    title: "Country of the week",
    content:
      "The country whose stack of resembled recipes is most worth a careful read this vintage. Sort and region filters below let you slice the full atlas; the colored border on each card is the family with the strongest match for that country.",
    placement: "left",
  },
  {
    page: "/countries",
    dimension: "b",
    target: '[data-tour="atlas-filters"]',
    title: "Filter and sort the atlas",
    content:
      "Region filter, family filter, sort by compound score or by number of recipes in play. The atlas is the entire roster of countries we cover, and these controls are how you cut it.",
    placement: "bottom",
  },
  {
    page: "/countries",
    dimension: "c",
    target: '[data-tour="atlas-grid"]',
    title: "Every country, as a card",
    content:
      "Each card is a small dossier: dominant family color on the border, the recipes the country is currently matching, the compound score. Tap any card for the full country view.",
    placement: "top",
  },
  {
    page: "/countries",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "Same rules apply",
    content:
      "Scores on this page are still ranks of resemblance, not probabilities. A country lit on three recipes is not three times more likely to break: it is a country whose current trajectory rhymes with three distinct historical patterns.",
    placement: "bottom",
  },

  // ─── /countries/sdn — 7 steps, ordered top-to-bottom ────────────────
  // Visual order on page: header (h1 + chips + lede) → Recipes in play →
  // Drivers (Why + What's moving) → Rank history → Analogs → Vintage sources
  // → how-to-read-button (last). The generate-report-button step was removed
  // (it is an upcoming, disabled feature; not tour-worthy yet).
  {
    page: "/countries/sdn",
    dimension: "a",
    target: "h1",
    title: "One country, in full",
    content:
      "What the platform currently says about Sudan, in plain language. The lede tells you how many recipes this country is in play on, across how many families, and reminds you that none of these recipes is deployed for real decisions. Resemblance, not prediction.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/countries/sdn",
    dimension: "b",
    target: '[data-tour="recipes-in-play-panel"]',
    title: "Recipes in play, scored and chipped",
    content:
      "Every recipe Sudan currently resembles, scored on the same 0 to 100 rank. The status chip on the right says whether that recipe has been deployed, was tested and did not hold up, is in review, or is still queued.",
    placement: "top",
  },
  {
    page: "/countries/sdn",
    dimension: "c",
    target: '[data-tour="drivers-panels"]',
    title: "Why and what's moving",
    content:
      "The two panels here split the question. 'Why' shows which indicators contributed most to the top resemblance score. 'What's moving' shows which indicators have shifted most lately. Together they answer: where did the score come from, and where is it heading.",
    placement: "top",
  },
  {
    page: "/countries/sdn",
    dimension: "c",
    target: '[data-tour="rank-history-panel"]',
    title: "Where the country sits over time",
    content:
      "How the country's rank on its top recipe has moved across recent quarters. Movement is a rank shift, not a probability change. A country climbing the list does not mean an event is more likely; it means its trajectory is matching the recipe shape more strongly than it was.",
    placement: "top",
  },
  {
    page: "/countries/sdn",
    dimension: "c",
    target: '[data-tour="analogs-panel"]',
    title: "Closest historical rhymes",
    content:
      "The three past cases whose trajectories most resemble this country's recent shape. Open Analogues from the sidebar to explore the full picker; this panel is the country-detail shorthand.",
    placement: "top",
  },
  {
    page: "/countries/sdn",
    dimension: "b",
    target: '[data-tour="vintage-sources-panel"]',
    title: "Provenance, in one place",
    content:
      "When the data was last refreshed, which providers it came from, and the methodology vintage. Visit this panel before quoting any number; freshness is part of the claim.",
    placement: "top",
  },
  {
    page: "/countries/sdn",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "Open this when you forget",
    content:
      "Every page has this button. It opens a quiet reference card with the four ground rules. The country page is the one most often deep-linked and shared, so it is worth opening before you cite a number from here.",
    placement: "bottom",
  },

  // ─── /risk-board — 5 steps, ordered top-to-bottom ────────────────────────
  // Visual order: h1 → RiskBoardHero strip → grid → recent movements →
  // how-to-read-button (last). HonestyDisclosure removed from page and tour.
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
    dimension: "b",
    target: '[data-tour="risk-board-grid"]',
    title: "Every recipe, top ten countries each",
    content:
      "The grid: each row is one recipe, each cell is one country's rank on it. Sort, filter by family, pin a country to track it across rows. Click any cell to open that recipe's full report card.",
    placement: "top",
  },
  {
    page: "/risk-board",
    dimension: "c",
    target: '[data-tour="recent-movements"]',
    title: "Who moved most this quarter",
    content:
      "Countries whose rank shifted most since the last data vintage. Up arrows are countries climbing the board, down arrows are countries falling. A rank shift is not a probability change.",
    placement: "top",
  },
  {
    page: "/risk-board",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "Open this when you forget",
    content:
      "Every page has this button. It opens a quiet reference card with the four ground rules. The risk board is the page most often misread as a probability board, so opening this on the way in is worth it.",
    placement: "bottom",
  },

  // /compound-risk tour steps removed 2026-05-30 — the route was taken
  // down. Tour-step authoring will return once the page is rejuvenated as
  // 'Compound Negative-Event Density' per the Stats/ML trio paper.

  // ─── /analogues — 5 steps, ordered top-to-bottom ────────────────────────
  // Visual order on page: h1 → picker (main column top) → results → recipe
  // contributions (still main column, below results) → methodology box (sticky
  // side panel, anchored top-right). Methodology box goes last in the tour
  // because it is the closing reference card.
  {
    page: "/analogues",
    dimension: "a",
    target: "h1",
    title: "Today's shape, in history",
    content:
      "Pick a country today, the engine shows you the closest historical match. Pure shape-matching across the recipe library. A similarity statement, never a forecast of what happens next.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/analogues",
    dimension: "c",
    target: '[data-tour="picker-panel"]',
    title: "Pick a country, see its rhyme",
    content:
      "Search for any country in the corpus. The page returns its three closest historical analogues, with what happened to those analog countries listed for context. That history is a fact about the analog, not a prediction about today's country.",
    placement: "right",
  },
  {
    page: "/analogues",
    dimension: "b",
    target: '[data-tour="analog-results"]',
    title: "Three matches, with outcomes",
    content:
      "Each match card carries the analog country, the year, a similarity score, and a brief note on what happened next. 'What happened next' is a fact about the analog, not a forecast about today's country. Read it that way and you read it correctly.",
    placement: "top",
  },
  {
    page: "/analogues",
    dimension: "c",
    target: '[data-tour="recipe-contributions"]',
    title: "Which recipes pulled the match",
    content:
      "A match is a weighted average of resemblances across the recipe library. This panel tells you which recipes did most of the pulling. A non-deployed recipe contributing 30 percent is not a green light; it is a flag, weighted into a similarity statement.",
    placement: "top",
  },
  {
    page: "/analogues",
    dimension: "c",
    target: '[data-tour="analog-methodology-box"]',
    title: "Resemblance, never forecast",
    content:
      "If you read one statement on this site, read this panel's four. Analogues matches are similarities, not forward predictions: today's Egypt looking like 2008 Tunisia means the trajectories rhyme, not that Egypt will follow Tunisia.",
    placement: "left",
  },
  {
    page: "/analogues",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "Open this when you forget",
    content:
      "Every page has this button. It opens a quiet reference card with the four ground rules. Analogues matches are similarities, not forward predictions -- open the rules on any page when you need to re-anchor.",
    placement: "bottom",
  },

  // ─── /compare — 6 steps, ordered top-to-bottom ──────────────────────────
  {
    page: "/compare",
    dimension: "a",
    target: "h1",
    title: "Two countries, same metrics",
    content:
      "Compare places two countries next to each other on the same set of recipes, today. The picker above the page is the page; everything below it is the comparison.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/compare",
    dimension: "c",
    target: '[data-tour="compare-picker"]',
    title: "Pick the two countries",
    content:
      "Type or pick any two countries. The URL updates so you can share the comparison; swap A and B with the arrow between them.",
    placement: "bottom",
  },
  {
    page: "/compare",
    dimension: "c",
    target: '[data-tour="generate-comparison-report-button"]',
    title: "A future button, previewed",
    content:
      "Disabled today, earmarked for a future release. A thinking AI model will read everything QGI knows about the two countries -- every recipe in play, the indicator drivers, the analogs -- and write you a side-by-side intelligence report.",
    placement: "bottom",
  },
  {
    page: "/compare",
    dimension: "b",
    target: '[data-tour="compare-at-a-glance"]',
    title: "The comparison's shape, in four numbers",
    content:
      "How many recipes each country is in play on, the biggest single-recipe rank gap between them, and how many recipes both are in play on at once.",
    placement: "bottom",
  },
  {
    page: "/compare",
    dimension: "c",
    target: '[data-tour="compare-matrix"]',
    title: "Read across, read down",
    content:
      "The main view. Read across to see where one country sits on a recipe. Read down to see which recipes both countries currently resemble. The colored bar is rank magnitude, not probability.",
    placement: "top",
  },
  {
    page: "/compare",
    dimension: "c",
    target: '[data-tour="compare-drivers"]',
    title: "Where the gap comes from",
    content:
      "For the top recipe both countries are in play on, the indicator attribution side by side. If the same indicator is doing the work for both countries, that is the shared driver of the comparison.",
    placement: "top",
  },
  {
    page: "/compare",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "Same rules apply",
    content:
      "Every cell on this page is a resemblance rank. A country at 80 and a country at 40 are not twice as risky and half as risky; they sit at different points on the same distribution. Open the rules whenever you need to re-anchor.",
    placement: "bottom",
  },

  // /recipe-tracker tour steps removed 2026-05-29 — the route was deleted
  // in the V4.1 round-3 amendment (2-bucket status vocabulary; the catalog-
  // ledger view folded into /recipes via the per-card Confidence badge).

  // ─── /patterns — 6 steps, ordered top-to-bottom ───────────────────────
  {
    page: "/patterns",
    dimension: "a",
    target: "h1",
    title: "Two countries, same arc",
    content:
      "A pattern is two countries whose stories ran in step for a long stretch of history. This page is the catalogue. Each row is a pair, the years they ran together, and how tightly they rhymed.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/patterns",
    dimension: "b",
    target: '[data-tour="patterns-overview-tiles"]',
    title: "How big the catalogue is",
    content:
      "Three numbers describe the catalogue at a glance: how many pairs are on file, how long the median pair ran in step, and which pair holds the longest run on record. Use them as scale before you dive in.",
    placement: "bottom",
  },
  {
    page: "/patterns",
    dimension: "c",
    target: '[data-tour="patterns-ranking-table"]',
    title: "The leaderboard, by pair strength",
    content:
      "The strongest paired rhymes on record, ranked. Sort by strength or by window length. Click any pair to open the detail. The score on the right is a rank from 0 to 100, not a probability.",
    placement: "top",
  },
  {
    page: "/patterns",
    dimension: "b",
    target: '[data-tour="patterns-family-browse"]',
    title: "Browse by event family",
    content:
      "Filter to pairs where at least one country in the pair currently resembles a recipe in a given family. The colors match the family colors on every other page.",
    placement: "top",
  },
  {
    page: "/patterns",
    dimension: "c",
    target: '[data-tour="patterns-country-browse"]',
    title: "Browse by country",
    content:
      "Pick any country to see every pair it appears in, sorted by rhyme strength. This is the entry point most analysts come back to.",
    placement: "top",
  },
  {
    page: "/patterns",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "Four rules, one click",
    content:
      "Open this on any page to re-anchor. The four rules on Patterns are the same four rules everywhere: scores are ranks not probabilities, the rhyme is between two countries' pasts not a forecast about either's future, corrections are published on purpose, nothing here is a forecast.",
    placement: "bottom",
  },

  // ─── /patterns/paraguay-south_korea-1963 — 7 steps ────────────────────
  {
    page: "/patterns/paraguay-south_korea-1963",
    dimension: "a",
    target: '[data-tour="pair-header"]',
    title: "A pair, not a leader and a follower",
    content:
      "You're looking at two countries whose trajectories ran in parallel over a shared historical window. The page treats them symmetrically. Neither country is described as leading or following the other.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    page: "/patterns/paraguay-south_korea-1963",
    dimension: "a",
    target: '[data-tour="pair-summary"]',
    title: "Where this pair sits",
    content:
      "Four numbers: where this pair ranks in the full catalogue, how long the shared window was, how many indicators went into it, and which decade was the strongest match.",
    placement: "bottom",
  },
  {
    page: "/patterns/paraguay-south_korea-1963",
    dimension: "b",
    target: '[data-tour="pair-shape-overlay"]',
    title: "What the resemblance looked like",
    content:
      "Both countries' indicator-composite trajectory over the shared window. Two lines. No arrow between them. The axis runs from benign to crisis; it isn't a probability.",
    placement: "top",
  },
  {
    page: "/patterns/paraguay-south_korea-1963",
    dimension: "c",
    target: '[data-tour="pair-indicators"]',
    title: "What the resemblance was made of",
    content:
      "The indicators that carried the rhyme. For each indicator, you'll see the historical year each country crossed a notable threshold on that indicator. Two timestamps, not a delta.",
    placement: "top",
  },
  {
    page: "/patterns/paraguay-south_korea-1963",
    dimension: "c",
    target: '[data-tour="pair-decades"]',
    title: "The rhyme decade by decade",
    content:
      "Small charts showing the resemblance held across multiple decades of the window, not just one. The shape language is the same vocabulary the main catalogue uses.",
    placement: "top",
  },
  {
    page: "/patterns/paraguay-south_korea-1963",
    dimension: "c",
    target: '[data-tour="pair-today"]',
    title: "Where each country is today",
    content:
      "Two cards, two links. Each country's present-day reading lives on its own profile page. This pair page doesn't synthesize a present-day claim from the past resemblance.",
    placement: "top",
  },
  {
    page: "/patterns/paraguay-south_korea-1963",
    dimension: "d",
    target: '[data-tour="how-to-read-button"]',
    title: "Read the four rules",
    content:
      "Open How to read for the four rules that govern this page. The most load-bearing rule for a pair: both countries' pasts, not either country's future.",
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
