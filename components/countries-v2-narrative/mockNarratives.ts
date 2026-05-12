/**
 * MOCK narrative content for the countries-v2-narrative design exploration.
 *
 * All text marked MOCK: is pre-written illustrative copy. In production
 * this would come from an AI-generation pipeline with human-review gating
 * (per the Sard Majles S-Country decision, Ingrid's human-review gate).
 *
 * Country IDs correspond to country-risks.json keys.
 */

export type WatchCountry = {
  id: string;
  name: string;
  alpha2: string;
  tier: "HIGH" | "MODERATE" | "INDICATIVE";
  previousTier: "HIGH" | "MODERATE" | "INDICATIVE" | null;
  /** MOCK: one-sentence movement summary shown on the index card */
  movementSentence: string;
  /** MOCK: which categories drove the current tier assignment */
  drivingCategories: string[];
};

/** MOCK: 5 countries to watch this quarter */
export const WATCH_COUNTRIES: WatchCountry[] = [
  {
    id: "217", // Syria
    name: "Syria",
    alpha2: "SY",
    tier: "HIGH",
    previousTier: "HIGH",
    movementSentence:
      "Syria remains at HIGH following the collapse of Idlib ceasefire talks; civil-conflict indicators show renewed displacement pressure in Q1 2026.",
    drivingCategories: [
      "civil_war_and_insurgency",
      "humanitarian_crisis",
      "foreign_intervention",
    ],
  },
  {
    id: "103", // Iran
    name: "Iran",
    alpha2: "IR",
    tier: "HIGH",
    previousTier: "MODERATE",
    movementSentence:
      "Iran moved from MODERATE to HIGH this quarter, driven by a sharp rise in political repression signals and elevated mass protest activity following the currency crisis.",
    drivingCategories: ["mass_protest", "political_repression", "fiscal_policy_change"],
  },
  {
    id: "237", // Venezuela
    name: "Venezuela",
    alpha2: "VE",
    tier: "HIGH",
    previousTier: "HIGH",
    movementSentence:
      "Venezuela remains HIGH; the humanitarian crisis dimension strengthened as the Maduro government's food-distribution controls tightened in late 2025.",
    drivingCategories: [
      "humanitarian_crisis",
      "political_repression",
      "elections_and_voting",
    ],
  },
  {
    id: "81", // Germany
    name: "Germany",
    alpha2: "DE",
    tier: "MODERATE",
    previousTier: "INDICATIVE",
    movementSentence:
      "Germany moved from INDICATIVE to MODERATE following a period of elevated elections and voting activity; the AfD's coalition entry in 2025 raised constitutional-change signals.",
    drivingCategories: [
      "elections_and_voting",
      "constitutional_change",
      "government_formation",
    ],
  },
  {
    id: "91", // Georgia (country)
    name: "Georgia",
    alpha2: "GE",
    tier: "MODERATE",
    previousTier: "INDICATIVE",
    movementSentence:
      "Georgia moved from INDICATIVE to MODERATE; bilateral treaty activity with the EU accelerated while domestic mass protest signals remained elevated after the disputed 2024 election.",
    drivingCategories: ["bilateral_treaty", "mass_protest", "elections_and_voting"],
  },
];

export type CountryNarrative = {
  id: string;
  /** MOCK: 2-3 sentence opening paragraph for the per-country page */
  openingParagraph: string;
  /** MOCK: top 3 driving categories with one-sentence explanations */
  drivingCategoryNarratives: Array<{
    category: string;
    label: string;
    sentence: string;
  }>;
  /** MOCK: 4-5 recent events with dates */
  recentEvents: Array<{
    date: string;
    title: string;
    explanation: string;
    categoryTag: string;
  }>;
  /** MOCK: peer comparison paragraph */
  peerParagraph: string;
  /** MOCK: peer country names for comparison */
  peers: string[];
};

/** MOCK: per-country narrative content (subset for design exploration) */
export const COUNTRY_NARRATIVES: Record<string, CountryNarrative> = {
  "217": {
    // Syria
    id: "217",
    openingParagraph:
      "Syria has carried a HIGH risk tier — the most elevated level in our scoring framework — for over a decade. What keeps it there isn't a single event but an interlocking set of conditions: an active civil conflict that has displaced more than 6 million people inside the country's borders, a state whose fiscal capacity collapsed in the mid-2010s, and an ongoing pattern of foreign military intervention that has made any stable equilibrium difficult to sustain. The three categories driving Syria's score right now are civil war activity, humanitarian crisis pressure, and foreign intervention — each feeding the others.",
    drivingCategoryNarratives: [
      {
        category: "civil_war_and_insurgency",
        label: "Civil war and insurgency",
        sentence:
          "Our civil-war model — which learned from battle-death statistics, refugee outflows, and political-polarization indicators — assigns Syria the highest confidence civil-conflict signal in our dataset. This is not a prediction that conflict will start; it has been ongoing. The signal reflects how deeply the structural conditions for sustained fighting remain in place.",
      },
      {
        category: "humanitarian_crisis",
        label: "Humanitarian crisis",
        sentence:
          "Syria accounts for a significant share of the training data for our humanitarian-crisis model, which is precisely why we disclose it explicitly: when Syria's indicators move, the model responds strongly. As of Q1 2026, cholera rates and internal displacement figures remain above the thresholds the model was trained to flag.",
      },
      {
        category: "foreign_intervention",
        label: "Foreign intervention",
        sentence:
          "Iranian, Russian, Turkish, and US-aligned forces have all operated in Syrian territory in the past decade. Our foreign-intervention model captures this through sovereignty-index changes and military-import trajectories — both remain elevated.",
      },
    ],
    recentEvents: [
      {
        date: "2025-11",
        title: "Idlib ceasefire negotiations collapse",
        explanation:
          "Turkish-Russian-brokered talks aimed at reducing Idlib fighting intensity broke down in November 2025, extending the conflict into its 15th year without a political resolution pathway.",
        categoryTag: "civil_war_and_insurgency",
      },
      {
        date: "2025-09",
        title: "WFP reduces Syria food-aid delivery 40%",
        explanation:
          "Funding shortfalls forced the World Food Programme to reduce monthly food-basket deliveries to 4.1 million Syrians, intensifying humanitarian pressure scores.",
        categoryTag: "humanitarian_crisis",
      },
      {
        date: "2025-07",
        title: "Iranian drone-supply corridor intercepted",
        explanation:
          "Israeli air operations targeted an Iranian logistics corridor in eastern Syria, marking the 12th publicly confirmed interdiction of that supply line since 2022.",
        categoryTag: "foreign_intervention",
      },
      {
        date: "2025-04",
        title: "UNHCR: 6.7 million internally displaced",
        explanation:
          "The annual UNHCR displacement report revised Syria's IDP figure upward, the first increase since 2021, reversing a slow improvement trend.",
        categoryTag: "humanitarian_crisis",
      },
      {
        date: "2024-12",
        title: "Syrian army loses Aleppo district to HTS",
        explanation:
          "Hayat Tahrir al-Sham's lightning offensive in late 2024 captured a significant Aleppo district, triggering a large civilian displacement spike that fed directly into Q1 2026 scores.",
        categoryTag: "civil_war_and_insurgency",
      },
    ],
    peerParagraph:
      "Syria sits in a small cohort of countries — alongside Yemen, Sudan, and Libya — where multiple risk categories reinforce each other simultaneously. Unlike Iran or Venezuela, where one or two categories dominate the HIGH tier assignment, Syria's score reflects structural interlocking across at least three categories. This makes it unusually resistant to tier movement: even significant improvements in one dimension (say, a ceasefire holding for 6 months) would not by itself lower the composite score, because the humanitarian and foreign-intervention signals remain independent.",
    peers: ["Yemen", "Sudan", "Libya", "Somalia"],
  },
  "103": {
    // Iran
    id: "103",
    openingParagraph:
      "Iran moved from MODERATE to HIGH this quarter — a tier transition that QGI flags as significant because it reflects a genuine change in underlying conditions, not noise. The driver is a combination of elevated mass protest activity following the rial's collapse against the dollar in February 2026, and a sharp uptick in political repression indicators as the government cracked down on protest organizers. Iran's political repression and mass protest categories have been on a slow upward trend since the 2022 Woman Life Freedom movement; this quarter's spike is an acceleration of that trend rather than a new phenomenon.",
    drivingCategoryNarratives: [
      {
        category: "mass_protest",
        label: "Mass protest",
        sentence:
          "Protest event density in Iran's major cities reached levels last seen during the 2022–2023 uprising, according to the ACLED event data our model is trained on. The current wave is economically triggered — currency and fuel prices — which tends to produce broader geographic spread than politically-triggered protests.",
      },
      {
        category: "political_repression",
        label: "Political repression",
        sentence:
          "V-Dem's political repression indicators, which track restrictions on civil society, internet shutdowns, and arbitrary detention rates, moved sharply negative for Iran in Q4 2025. Our model weighted these trajectory changes heavily in the tier decision.",
      },
      {
        category: "fiscal_policy_change",
        label: "Fiscal policy change",
        sentence:
          "Iran's fiscal-policy signals reflect a government attempting to manage subsidy removal and currency depreciation simultaneously — a historically volatile combination in our training data. The fiscal pressure is the structural cause driving the other two categories.",
      },
    ],
    recentEvents: [
      {
        date: "2026-02",
        title: "Rial collapses to 900,000 per US dollar",
        explanation:
          "A new low for the rial triggered a weekend of protests in Tehran, Isfahan, and Shiraz, with security forces deploying riot control measures within 48 hours.",
        categoryTag: "fiscal_policy_change",
      },
      {
        date: "2026-01",
        title: "Internet shutdown during protest wave",
        explanation:
          "Iranian authorities imposed a 72-hour internet restriction in six provinces during a January protest wave — the first multi-province shutdown since November 2022.",
        categoryTag: "political_repression",
      },
      {
        date: "2025-11",
        title: "IAEA: enrichment at 60% resumed at Fordow",
        explanation:
          "Iran resumed 60% enrichment at the Fordow underground facility following the breakdown of informal US-Iran talks, increasing sanctions pressure and fiscal stress.",
        categoryTag: "fiscal_policy_change",
      },
      {
        date: "2025-09",
        title: "Labor unions arrested after steel-sector strike",
        explanation:
          "Security forces detained 47 union leaders following a 10-day strike at Khuzestan Steel Works — one of the largest labor actions since 2019.",
        categoryTag: "mass_protest",
      },
      {
        date: "2025-06",
        title: "Khamenei successor speculation intensifies",
        explanation:
          "Reports of Khamenei's deteriorating health and competing factions positioning for succession entered the political mainstream, raising government-formation uncertainty.",
        categoryTag: "political_repression",
      },
    ],
    peerParagraph:
      "Iran's HIGH tier assignment this quarter places it alongside countries whose scores are driven by political-economy stress rather than open conflict. The closest structural peers — countries that moved from MODERATE to HIGH through similar protest-and-repression combinations — include Belarus (2020), Thailand (2021), and Tunisia (2023). In each of those cases, the tier elevation proved persistent for 4–8 quarters. Venezuela and Russia are also HIGH, but through different mechanisms (humanitarian collapse and foreign-policy assertiveness respectively), so their trajectories are less instructive for forecasting Iran's path.",
    peers: ["Belarus", "Thailand", "Venezuela", "Russia"],
  },
  "81": {
    // Germany
    id: "81",
    openingParagraph:
      "Germany is a MODERATE risk country — which in QGI's framework means it sits in the middle band of the global distribution, not that risk is negligible. For a stable OECD democracy, MODERATE is worth explaining: Germany's score is driven almost entirely by political transition dynamics, not by security or humanitarian pressures. The elections-and-voting category is the dominant signal. Germany held federal elections in February 2025 under unusual circumstances — the first snap election since 2005 — and the resulting coalition that included the AfD for the first time in any governing coalition introduced a constitutional-change signal that continues to register.",
    drivingCategoryNarratives: [
      {
        category: "elections_and_voting",
        label: "Elections and voting",
        sentence:
          "The elections-and-voting category measures contested elections, contested transfers of power, and post-election instability — not just the fact of an election occurring. Germany's February 2025 snap election scores elevated because of the unusual coalition arithmetic and two no-confidence votes in the months preceding it.",
      },
      {
        category: "constitutional_change",
        label: "Constitutional change",
        sentence:
          "The AfD's entry into a governing coalition produced a cluster of constitutional-change signals — debates over Basic Law amendments, Verfassungsschutz monitoring of governing-party MPs, and a Bundesrat challenge to a new security law. These are low-severity individually but the cluster is what moved the score.",
      },
      {
        category: "government_formation",
        label: "Government formation",
        sentence:
          "Coalition formation in Germany took 67 days after the February election — the second-longest since 1949. Government-formation delays are a direct input to our model because they correlate with governance uncertainty that affects investment and policy continuity.",
      },
    ],
    recentEvents: [
      {
        date: "2025-10",
        title: "Bundestag votes on constitutional amendment, fails by 4 votes",
        explanation:
          "A proposed amendment to the debt brake — backed by CDU/CSU and AfD but rejected by the SPD in coalition — became a flashpoint for coalition tensions, producing a governance uncertainty signal.",
        categoryTag: "constitutional_change",
      },
      {
        date: "2025-07",
        title: "Verfassungsschutz opens probe into AfD federal minister",
        explanation:
          "The domestic intelligence agency opened an observation procedure against an AfD cabinet minister, the first time a sitting minister has been subject to such a procedure.",
        categoryTag: "political_repression",
      },
      {
        date: "2025-05",
        title: "CDU/CSU-AfD coalition finalized after 67 days",
        explanation:
          "Germany's coalition government was formally constituted, ending the longest post-election formation period since 1949 and reducing the government-formation signal.",
        categoryTag: "government_formation",
      },
      {
        date: "2025-02",
        title: "Federal election: AfD wins 22.6%, enters coalition talks",
        explanation:
          "The February snap election produced a result that broke the previous firewall against AfD coalition participation at the federal level, triggering the constitutional-change signals that moved Germany's tier.",
        categoryTag: "elections_and_voting",
      },
    ],
    peerParagraph:
      "Germany's MODERATE score sits alongside other OECD democracies experiencing political transition stress: France (electoral realignment), Poland (judiciary normalization disputes), and South Korea (impeachment cycle in 2024). These countries share a pattern — strong institutions that generate elevated signals precisely because contested processes are being worked through visibly, rather than suppressed. This is categorically different from the MODERATE scores of countries like Colombia or Tunisia, where the economic-security mix drives the tier.",
    peers: ["France", "Poland", "South Korea", "Spain"],
  },
};

/** MOCK: "What is a high-risk country, really?" worked example */
export const WORKED_EXAMPLE = {
  country: "Iran",
  id: "103",
  tier: "HIGH" as const,
  shortExplanation:
    "Iran moved from MODERATE to HIGH this quarter. That single-word tier change represents a specific mathematical threshold: the composite of 71 risk categories crossed into the top 20% of all 156 scored countries. Here's what that actually means.",
  factoids: [
    "71 categories were assessed — covering everything from election integrity to currency stability to battle-related deaths",
    "Each category gets a z-score: how far is this country's signal from the global average this quarter?",
    "The z-scores are combined via a Reciprocal Rank Fusion ensemble — a method that gives more weight to categories that rank highly across multiple independent time-horizon windows",
    "HIGH means the composite score sits in the top 20% globally — not that conflict is inevitable, but that the structural conditions are more elevated than 80% of the countries we track",
  ],
};
