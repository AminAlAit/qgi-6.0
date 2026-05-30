/**
 * Page-aware "How to read this page" content for the HowToReadDrawer.
 *
 * One entry per V4.1 route. The 4-rule spine is constant across all pages;
 * the noun and sentence framing shift to match what the reader is actually
 * looking at on that page.
 *
 * Rules must carry no banned vocabulary (M8-R5, HARD_FAIL, LOCO, gate,
 * Majles, F-ML-1, cascade-vs-ML, etc.) and no em-dashes.
 */

export type RouteKey =
  | "dashboard-v4.1"
  | "recipes-v4.1"
  | "recipes-v4.1-detail"
  | "countries-v4.1"
  | "countries-v4.1-detail"
  | "risk-board"
  | "compound-risk"
  | "analogues"
  | "recipe-tracker"
  | "compare"
  | "patterns-v4"
  | "patterns-v4-detail";

export interface RuleEntry {
  /** Short title, sentence case, ~5 words. */
  title: string;
  /** 1-2 sentences, plain English, page-aware noun. */
  body: string;
}

export interface PageHowToRead {
  /** 1 sentence, page-specific framing. */
  lede: string;
  rules: [RuleEntry, RuleEntry, RuleEntry, RuleEntry];
}

export const HOW_TO_READ_CONTENT: Record<RouteKey, PageHowToRead> = {
  "dashboard-v4.1": {
    lede: "Four rules for everything you read on this dashboard.",
    rules: [
      {
        title: "Scores are ranks, not probabilities",
        body: "Every score on this page is a resemblance rank: how closely a country's recent trajectory matches a validated historical pattern. A rank of 80 is not an 80% chance of anything.",
      },
      {
        title: "Counts come from the tracker",
        body: "The hero tile counts and the activity feed are pulled from the Recipe Tracker, which is the source of truth. Nothing on this dashboard upgrades or changes a recipe's status.",
      },
      {
        title: "Corrections are published on purpose",
        body: "When a prior validation does not survive audit, we withdraw it publicly in the activity log. Visible corrections are part of how the program works, not a sign of failure.",
      },
      {
        title: "Nothing here is a forecast",
        body: "QGI describes resemblance, not a forecast about which country will see which event in which year.",
      },
    ],
  },

  "recipes-v4.1": {
    lede: "Four rules for reading the recipe catalogue.",
    rules: [
      {
        title: "Scores are ranks, not probabilities",
        body: "Every score listed for a recipe is a resemblance rank against historical precedents, not a probability that the event will recur. A higher rank means a closer structural match.",
      },
      {
        title: "Status comes from the tracker",
        body: "The status badge on each recipe (validated, tested, queued, and so on) is the Recipe Tracker's current reading. The catalogue table reflects that source directly.",
      },
      {
        title: "Corrections are published on purpose",
        body: "If a recipe's prior status did not survive re-evaluation, the revised status appears here alongside a public note. That transparency is intentional.",
      },
      {
        title: "Nothing here is a forecast",
        body: "A recipe describes a structural pattern observed in historical data. It does not predict whether or when a specific country will experience that event.",
      },
    ],
  },

  "recipes-v4.1-detail": {
    lede: "Four rules for reading a single recipe's detail page.",
    rules: [
      {
        title: "Scores are ranks, not probabilities",
        body: "Every country score on this recipe page is a resemblance rank showing how closely that country's current indicators match the historical pattern for this event type. It is not a probability of occurrence.",
      },
      {
        title: "Counts come from the tracker",
        body: "The validation status, run history, and indicator count shown here are drawn from the Recipe Tracker. The detail page does not produce its own status.",
      },
      {
        title: "Corrections are published on purpose",
        body: "If this recipe was previously validated and that result was later withdrawn, you will see both states and the reason. Withdrawals are part of the methodology record.",
      },
      {
        title: "Nothing here is a forecast",
        body: "This recipe describes resemblance between a country's current trajectory and a historical instability pattern. It does not forecast a specific event in a specific year.",
      },
    ],
  },

  "countries-v4.1": {
    lede: "Four rules for reading the country list.",
    rules: [
      {
        title: "Scores are ranks, not probabilities",
        body: "Every score next to a country name is a resemblance rank within the current panel, not a probability of instability. Countries ranked close together can have very different underlying situations.",
      },
      {
        title: "Counts come from the tracker",
        body: "The recipe counts and status badges shown per country are pulled from the Recipe Tracker. The countries list does not generate its own recipe statuses.",
      },
      {
        title: "Corrections are published on purpose",
        body: "When a recipe that previously scored a country is withdrawn or revised, the country's count updates accordingly. That is expected behavior, not a data error.",
      },
      {
        title: "Nothing here is a forecast",
        body: "Country scores describe how structurally similar a country is to historical precedents for various event types. They do not predict events in specific countries at specific times.",
      },
    ],
  },

  "countries-v4.1-detail": {
    lede: "Four rules for reading a single country's profile.",
    rules: [
      {
        title: "Scores are ranks, not probabilities",
        body: "Every recipe lit on this country page shows a resemblance rank, not a probability. A recipe marked as firing means this country's current indicators structurally resemble historical cases where that event type occurred.",
      },
      {
        title: "Recipe status comes from the tracker",
        body: "The validated or tested status for each recipe shown here is drawn from the Recipe Tracker. The country profile reflects those statuses; it does not set them.",
      },
      {
        title: "Corrections are published on purpose",
        body: "If a recipe that previously fired for this country has since been withdrawn or revised, the profile updates to show the corrected state. The prior result is not erased.",
      },
      {
        title: "Nothing here is a forecast",
        body: "The indicators and pattern scores on this page describe structural resemblance to historical cases. They do not constitute a prediction of a specific event for this country.",
      },
    ],
  },

  "risk-board": {
    lede: "Four rules for reading the risk board grid.",
    rules: [
      {
        title: "Scores are ranks, not probabilities",
        body: "Every cell on the board holds a resemblance rank showing how closely a country-recipe pair matches its validated historical pattern. A higher number is a closer structural match, not a higher probability of an event.",
      },
      {
        title: "Cell status comes from the tracker",
        body: "The color coding and status of each cell reflect the Recipe Tracker's current reading for that recipe. The board is a visualization of tracker data, not an independent scoring layer.",
      },
      {
        title: "Corrections are published on purpose",
        body: "When a recipe status changes after audit, the relevant cells update. Empty or revised cells after a prior fill are the methodology working correctly.",
      },
      {
        title: "Nothing here is a forecast",
        body: "The board shows structural resemblance across countries and event types simultaneously. It is a comparative view, not a ranked list of countries most likely to experience events.",
      },
    ],
  },

  "compound-risk": {
    lede: "Four rules for reading compound risk scores.",
    rules: [
      {
        title: "Compound scores stack ranks, not odds",
        body: "A compound score adds up resemblance ranks from multiple recipes for a single country. It does not multiply probabilities. Two recipes each at rank 70 produce a compound score of 140, not a 70% combined probability.",
      },
      {
        title: "Input statuses come from the tracker",
        body: "Only recipes with a current validated status in the Recipe Tracker contribute to compound scores. The tracker is the source of truth for which recipes are eligible to stack.",
      },
      {
        title: "Corrections are published on purpose",
        body: "When a recipe contributing to a compound score is withdrawn, that country's compound score changes. The change is expected and is reported alongside the withdrawal notice.",
      },
      {
        title: "Nothing here is a forecast",
        body: "A high compound score means a country simultaneously resembles historical patterns across several event types. It does not forecast that multiple events will occur.",
      },
    ],
  },

  analogues: {
    lede: "Four rules for reading Analogues matches.",
    rules: [
      {
        title: "Matches are similarities, not predictions",
        body: "Each analogue pair shows two countries whose indicator trajectories ran in close parallel over a shared historical window. Structural similarity over the past does not predict that the target country will follow the reference country's future path.",
      },
      {
        title: "Analogue scores come from validated recipes",
        body: "The recipe scores shown alongside analogue pairs are drawn from the Recipe Tracker. An analogue's relevance depends on whether the shared recipes are validated; the tracker is the source of truth for that.",
      },
      {
        title: "Corrections are published on purpose",
        body: "If a recipe that anchored an analogue pair is later revised or withdrawn, the pair's displayed context updates. The analogue itself stays in the record; its recipe context is corrected.",
      },
      {
        title: "Nothing here is a forecast",
        body: "Finding that Country A resembles Country B at a given historical moment does not mean Country A will replicate Country B's subsequent trajectory. Analogy is a structural lens, not a forward projection.",
      },
    ],
  },

  compare: {
    lede: "Four rules for reading a side-by-side comparison.",
    rules: [
      {
        title: "Scores are ranks, not probabilities",
        body: "Every cell on this page is a resemblance rank showing how closely each country's recent trajectory matches a recipe today. A 30-point gap between two countries on a recipe is a gap in rank position, not a gap in event probability.",
      },
      {
        title: "Comparison is structural, not relative",
        body: "Placing two countries next to each other on the same recipes does not declare a winner or rank one as more at risk than the other. Both countries sit on the same distribution; the page shows you where each one currently sits.",
      },
      {
        title: "Status comes from the tracker",
        body: "The status chip on each recipe row (deployed, tested, queued, withdrawn) is drawn from the Recipe Tracker, which is the source of truth. The comparison view reflects those statuses; it does not set them.",
      },
      {
        title: "Nothing here is a forecast",
        body: "A side-by-side comparison describes how two countries' structural shapes look today. It does not predict which country will experience a specific event, nor which one will experience it first.",
      },
    ],
  },

  "patterns-v4": {
    lede: "Four rules for reading the patterns catalogue.",
    rules: [
      {
        title: "Strength is a rank, not a probability",
        body: "Every pair strength on this page is a 0-to-100 rank showing how tightly two countries' indicator trajectories rhymed over a shared historical window. A pair at 91 is at the top of the distribution, not 91 percent likely to do anything.",
      },
      {
        title: "Both countries' pasts, not either's future",
        body: "A pattern describes the historical record. Argentina and Russia running together through the 1990s is a fact about those decades. It does not say that Argentina will follow Russia next, or that Russia will follow Argentina next. The rhyme is symmetric and historical.",
      },
      {
        title: "Corrections are published on purpose",
        body: "When a pair's window or strength is revised after a fresh data vintage, the change appears here. A pair sliding out of the top 30 between vintages is the methodology working as designed.",
      },
      {
        title: "Nothing here is a forecast",
        body: "Pair-rhymes are a historical-shape lens. They describe how two countries' stories ran together, not how either country's story will unfold next. Read them as analogies, not as predictions.",
      },
    ],
  },

  "patterns-v4-detail": {
    lede: "Four rules for reading a single pair of countries' shared past.",
    rules: [
      {
        title: "Scores are ranks, not probabilities",
        body: "The strength of this pair, the indicator contribution bars, and the catalogue rank shown on this page are all resemblance ranks. They describe how closely two countries' historical trajectories ran together. They are not probabilities of any current or future event for either country.",
      },
      {
        title: "Both countries' pasts, not either's future",
        body: "The page describes a shared historical window. Even when one country's indicators crossed a threshold years before the other country's did, that fact is historical. It is not a signal that the second country will repeat the first country's later trajectory. The page treats the two countries symmetrically for that reason.",
      },
      {
        title: "Per-indicator timestamps are facts, pair-level direction is not",
        body: "Inside the indicators panel you will see two years per indicator: the historical year each country crossed a notable threshold on that indicator. Those two years are facts. The page does not combine them into a single direction for the whole pair, because doing so would imply a forecast the methodology cannot support.",
      },
      {
        title: "Nothing here is a forecast",
        body: "Finding that two countries resembled each other across a historical window does not tell you that either country will resemble its past, or the other country's past, going forward. To read either country's present, follow the country-profile link at the bottom of the page. The two countries' present-day stories are not narrated on this page.",
      },
    ],
  },

  "recipe-tracker": {
    lede: "Four rules for reading the Recipe Tracker, which is the source of truth for all recipe statuses across QGI.",
    rules: [
      {
        title: "Scores are ranks, not probabilities",
        body: "Where resemblance scores appear on this page, they are ranks showing structural similarity to historical patterns. The tracker's own role is to record validation status, not to generate probability estimates.",
      },
      {
        title: "This page is the source of truth",
        body: "Every recipe status you see anywhere on QGI traces back to this tracker. If you see a discrepancy between another page and this one, this tracker's reading is correct.",
      },
      {
        title: "Corrections are published on purpose",
        body: "Status changes, withdrawals, and revisions are logged here with timestamps. The full history of a recipe's status is part of the methodology record, not a footnote.",
      },
      {
        title: "Nothing here is a forecast",
        body: "A validated recipe means the historical pattern was confirmed to exist and be statistically meaningful. Validation status does not imply a forecast about when or where the pattern will next occur.",
      },
    ],
  },
};
