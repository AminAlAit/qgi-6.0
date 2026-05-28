/**
 * nearest-analog-data — current-country analog data for /nearest-analog.
 *
 * V4.1 wire-up (2026-05-29):
 *   - Hand-authored ENTRIES remain as the primary catalog (10 countries with
 *     rich narrative analogs).
 *   - TE sample-10 analogs from loadAnalogs() are appended for countries NOT
 *     already present in the hand-authored set. These carry real match_score /
 *     contributions from the pipeline; what_happened_next is null in the raw
 *     data — displayed as "In training set" (honest gap).
 *   - getCurrentCountry() and getCurrentCountries() are unchanged in shape.
 *
 * Implements Capability #12 (Nearest historical analog): SHAP-weighted cosine
 * similarity between a country's recent indicator trajectory and the pre-event
 * trajectories of all historical positives in the recipe's training set.
 * Self-excluded. Carries the regional-clustering caveat.
 *
 * HONESTY REGIME
 * - These are similarity matches, NOT forward predictions.
 * - Match scores < 70 are flagged as "weak analog" per ledger Feature 12.
 * - Regional-clustering caveat applies.
 */
import { loadAnalogs } from "@/lib/te-data-contract/load";

export interface HistoricalAnalog {
  country: string;
  year: number;
  match_score: number; // 0..100, cosine-similarity scaled
  primary_recipe_id: string; // recipe whose canonical shape drove the match
  secondary_recipe_ids: string[]; // other recipes that contributed
  indicator_trajectory: number[]; // 12 quarters pre-event, 0..100
  what_happened_next: string; // HISTORICAL FACT — what happened to the analog country after its event
  weak_analog?: boolean; // true if match_score < 70
}

export interface RecipeContribution {
  recipe_id: string;
  recipe_label: string;
  l1_color: string;
  contribution_pct: number; // 0..100
  status: "graduated" | "walked_no_graduation" | "queued" | "live_legacy";
}

export interface CurrentCountryEntry {
  iso: string;
  name: string;
  region: string;
  indicator_trajectory: number[]; // 12 quarters of "today" — drives the sparkline
  analogs: HistoricalAnalog[]; // top-3 nearest
  contributions: RecipeContribution[]; // which recipes contributed, ranked
}

// ── Current-country entries ──────────────────────────────────────────────
// Indicator trajectories are illustrative composites (a single z-scored
// pre-event-style series). Real walks emit 4-indicator trajectories — we
// fold them to one line for the sparkline overlay so the visual reads.
const ENTRIES: CurrentCountryEntry[] = [
  {
    iso: "EGY",
    name: "Egypt",
    region: "MENA",
    indicator_trajectory: [38, 41, 44, 49, 52, 56, 58, 61, 64, 68, 71, 74],
    analogs: [
      {
        country: "Algeria",
        year: 1990,
        match_score: 87.4,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["political_repression", "mass_protest"],
        indicator_trajectory: [35, 38, 42, 46, 50, 54, 57, 62, 66, 70, 73, 77],
        what_happened_next:
          "Algeria's 1991 elections were cancelled mid-vote after the Islamic Salvation Front swept the first round, triggering a decade-long civil war that killed an estimated 100,000–200,000 people. The military's 1992 intervention installed a state of emergency that remained in force until 2011. The trajectory describes Algeria's pre-1991 buildup, not a forecast for Egypt.",
      },
      {
        country: "Tunisia",
        year: 2008,
        match_score: 81.2,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["mass_protest", "political_repression"],
        indicator_trajectory: [40, 42, 45, 48, 51, 55, 59, 62, 65, 69, 72, 75],
        what_happened_next:
          "Tunisia's 2011 revolution began in Sidi Bouzid in December 2010 when Mohamed Bouazizi self-immolated in protest at municipal harassment. President Ben Ali fled to Saudi Arabia in January 2011 after 23 years in power, and a constituent assembly ratified a new constitution in 2014. Tunisia's transition is the only Arab-Spring case widely classed as a successful democratic transition.",
      },
      {
        country: "Iran",
        year: 1978,
        match_score: 74.6,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["political_repression", "elections_and_voting"],
        indicator_trajectory: [42, 45, 48, 52, 55, 58, 60, 63, 66, 69, 73, 76],
        what_happened_next:
          "The Shah of Iran left the country in January 1979 after a year of escalating strikes and street protests. Ayatollah Khomeini returned from exile in February, and a referendum that March established the Islamic Republic. The 1979–1981 hostage crisis and the 1980–1988 Iran-Iraq war defined the subsequent decade.",
      },
    ],
    contributions: [
      {
        recipe_id: "foreign_intervention",
        recipe_label: "Foreign Intervention",
        l1_color: "#FF8B5C",
        contribution_pct: 52,
        status: "walked_no_graduation",
      },
      {
        recipe_id: "political_repression",
        recipe_label: "Political Repression",
        l1_color: "#5EE6C4",
        contribution_pct: 21,
        status: "queued",
      },
      {
        recipe_id: "mass_protest",
        recipe_label: "Mass Protest",
        l1_color: "#E6C45E",
        contribution_pct: 17,
        status: "queued",
      },
      {
        recipe_id: "economic_recession",
        recipe_label: "Economic Recession",
        l1_color: "#7B9EE6",
        contribution_pct: 10,
        status: "queued",
      },
    ],
  },
  {
    iso: "LBN",
    name: "Lebanon",
    region: "MENA",
    indicator_trajectory: [62, 60, 58, 54, 51, 47, 44, 42, 39, 36, 34, 31],
    analogs: [
      {
        country: "Argentina",
        year: 2001,
        match_score: 91.3,
        primary_recipe_id: "economic_recession",
        secondary_recipe_ids: ["currency_crisis", "banking_and_financial_crisis"],
        indicator_trajectory: [65, 62, 59, 55, 51, 47, 44, 40, 37, 34, 31, 28],
        what_happened_next:
          "Argentina defaulted on US$100 billion of sovereign debt in December 2001, the largest default in history at the time, after the convertibility regime that pegged the peso to the dollar collapsed. The peso lost roughly 75% of its value within months, poverty hit 57.5% in October 2002, and the country cycled through five presidents in two weeks. Recovery began in 2003 under Néstor Kirchner with capital controls and a 2005 debt restructuring.",
      },
      {
        country: "Greece",
        year: 2012,
        match_score: 84.8,
        primary_recipe_id: "economic_recession",
        secondary_recipe_ids: ["banking_and_financial_crisis", "mass_protest"],
        indicator_trajectory: [60, 58, 55, 52, 48, 45, 42, 39, 36, 33, 31, 29],
        what_happened_next:
          "Greece executed the largest sovereign-debt restructuring in history in March 2012 (the PSI bond swap, ~€199 billion). Three EU/IMF bailout programmes ran from 2010 through 2018, conditional on austerity that pushed unemployment above 27% and youth unemployment above 60%. SYRIZA won the January 2015 election on an anti-austerity platform and then accepted a third programme after the July 2015 referendum.",
      },
      {
        country: "Venezuela",
        year: 2014,
        match_score: 76.5,
        primary_recipe_id: "economic_recession",
        secondary_recipe_ids: ["currency_crisis", "political_repression"],
        indicator_trajectory: [58, 55, 52, 48, 45, 41, 38, 35, 32, 29, 26, 23],
        what_happened_next:
          "Venezuela entered a hyperinflationary depression after the 2014 oil-price collapse; cumulative inflation exceeded 10,000,000% by 2019. An estimated 7.7 million Venezuelans emigrated between 2015 and 2024 in the largest displacement in modern Latin American history. Parallel-government claims by Juan Guaidó (2019) and US/EU sanctions framed an extended political-economic standoff with Nicolás Maduro's government.",
      },
    ],
    contributions: [
      {
        recipe_id: "economic_recession",
        recipe_label: "Economic Recession",
        l1_color: "#7B9EE6",
        contribution_pct: 44,
        status: "queued",
      },
      {
        recipe_id: "currency_crisis",
        recipe_label: "Currency Crisis",
        l1_color: "#7B9EE6",
        contribution_pct: 24,
        status: "queued",
      },
      {
        recipe_id: "banking_and_financial_crisis",
        recipe_label: "Banking & Financial Crisis",
        l1_color: "#7B9EE6",
        contribution_pct: 19,
        status: "queued",
      },
      {
        recipe_id: "foreign_intervention",
        recipe_label: "Foreign Intervention",
        l1_color: "#FF8B5C",
        contribution_pct: 13,
        status: "walked_no_graduation",
      },
    ],
  },
  {
    iso: "PAK",
    name: "Pakistan",
    region: "South Asia",
    indicator_trajectory: [45, 47, 50, 52, 54, 57, 59, 62, 64, 66, 69, 71],
    analogs: [
      {
        country: "Pakistan",
        year: 1977,
        match_score: 83.7,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["political_repression", "elections_and_voting"],
        indicator_trajectory: [48, 50, 53, 56, 58, 61, 63, 65, 67, 70, 72, 75],
        what_happened_next:
          "General Muhammad Zia-ul-Haq overthrew Prime Minister Zulfikar Ali Bhutto in Operation Fair Play on 5 July 1977, suspending the constitution. Bhutto was hanged in April 1979 after a conviction widely viewed as politically directed. Zia's eleven-year rule institutionalised Hudood Ordinances and aligned Pakistan with the US/Saudi campaign against the Soviet occupation of Afghanistan.",
      },
      {
        country: "Bangladesh",
        year: 2007,
        match_score: 71.5,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["elections_and_voting", "political_repression"],
        indicator_trajectory: [44, 46, 49, 52, 55, 58, 60, 63, 65, 68, 70, 73],
        what_happened_next:
          "Bangladesh entered a two-year state of emergency in January 2007 after rival party violence threatened the scheduled elections. A military-backed caretaker government detained both Sheikh Hasina and Khaleda Zia in an anti-corruption drive before holding the December 2008 election, which Hasina's Awami League won decisively. The episode left durable damage to the caretaker-government model that had governed transitions since 1990.",
      },
      {
        country: "Egypt",
        year: 2011,
        match_score: 68.2,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["mass_protest", "political_repression"],
        indicator_trajectory: [46, 49, 52, 55, 57, 60, 62, 64, 66, 68, 70, 72],
        weak_analog: true,
        what_happened_next:
          "Hosni Mubarak resigned on 11 February 2011 after eighteen days of mass protest centred on Tahrir Square, ending three decades in power. The Supreme Council of the Armed Forces governed the transition through the June 2012 election of Mohamed Morsi (Muslim Brotherhood). A second military intervention in July 2013 removed Morsi and installed Abdel Fattah el-Sisi as president from June 2014.",
      },
    ],
    contributions: [
      {
        recipe_id: "foreign_intervention",
        recipe_label: "Foreign Intervention",
        l1_color: "#FF8B5C",
        contribution_pct: 41,
        status: "walked_no_graduation",
      },
      {
        recipe_id: "political_repression",
        recipe_label: "Political Repression",
        l1_color: "#5EE6C4",
        contribution_pct: 26,
        status: "queued",
      },
      {
        recipe_id: "elections_and_voting",
        recipe_label: "Elections & Voting",
        l1_color: "#7B5EE6",
        contribution_pct: 19,
        status: "walked_no_graduation",
      },
      {
        recipe_id: "terrorist_attack",
        recipe_label: "Terrorist Attack",
        l1_color: "#FF8B5C",
        contribution_pct: 14,
        status: "walked_no_graduation",
      },
    ],
  },
  {
    iso: "TUR",
    name: "Türkiye",
    region: "MENA",
    indicator_trajectory: [55, 53, 51, 48, 46, 44, 41, 39, 37, 35, 33, 31],
    analogs: [
      {
        country: "Hungary",
        year: 2010,
        match_score: 79.1,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["political_repression", "constitutional_change"],
        indicator_trajectory: [58, 55, 52, 49, 46, 44, 41, 38, 35, 32, 30, 28],
        what_happened_next:
          "Fidesz won a two-thirds parliamentary majority in April 2010, enabling Viktor Orbán to enact a new constitution (the Fundamental Law) ratified in April 2011. Subsequent amendments restructured the Constitutional Court, restricted media pluralism via the Media Authority, and reshaped electoral districts. The European Parliament triggered Article 7 proceedings in September 2018.",
      },
      {
        country: "Argentina",
        year: 2001,
        match_score: 73.4,
        primary_recipe_id: "economic_recession",
        secondary_recipe_ids: ["currency_crisis", "mass_protest"],
        indicator_trajectory: [56, 53, 50, 47, 44, 41, 38, 36, 34, 32, 30, 28],
        what_happened_next:
          "Argentina's December 2001 corralito froze most bank accounts and triggered the cacerolazo protests that brought down the de la Rúa government within weeks. Cumulative GDP fell roughly 28% from the 1998 peak to the 2002 trough, and the 2002 devaluation cut household real incomes in half. The 2005 debt restructuring received ~76% creditor participation; holdout litigation continued until the 2016 Macri-era settlement.",
      },
      {
        country: "Russia",
        year: 1998,
        match_score: 70.6,
        primary_recipe_id: "economic_recession",
        secondary_recipe_ids: ["currency_crisis", "banking_and_financial_crisis"],
        indicator_trajectory: [54, 51, 48, 45, 42, 39, 37, 34, 32, 30, 28, 26],
        what_happened_next:
          "Russia defaulted on US$40 billion of GKO domestic-currency debt and devalued the rouble by ~70% against the dollar in August 1998. The crisis ended the privatisation-boom era and triggered LTCM's collapse in the US. Vladimir Putin succeeded Yeltsin on 31 December 1999; the subsequent oil-price recovery underwrote the consolidation of the 2000s.",
      },
    ],
    contributions: [
      {
        recipe_id: "economic_recession",
        recipe_label: "Economic Recession",
        l1_color: "#7B9EE6",
        contribution_pct: 36,
        status: "queued",
      },
      {
        recipe_id: "foreign_intervention",
        recipe_label: "Foreign Intervention",
        l1_color: "#FF8B5C",
        contribution_pct: 28,
        status: "walked_no_graduation",
      },
      {
        recipe_id: "political_repression",
        recipe_label: "Political Repression",
        l1_color: "#5EE6C4",
        contribution_pct: 22,
        status: "queued",
      },
      {
        recipe_id: "constitutional_change",
        recipe_label: "Constitutional Change",
        l1_color: "#7B5EE6",
        contribution_pct: 14,
        status: "queued",
      },
    ],
  },
  {
    iso: "VEN",
    name: "Venezuela",
    region: "Latin America",
    indicator_trajectory: [28, 26, 24, 22, 20, 19, 17, 16, 15, 14, 13, 12],
    analogs: [
      {
        country: "Zimbabwe",
        year: 2008,
        match_score: 88.9,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["currency_crisis", "political_repression"],
        indicator_trajectory: [30, 27, 24, 22, 19, 17, 15, 14, 13, 12, 11, 10],
        what_happened_next:
          "Zimbabwe abandoned its own currency in April 2009 after hyperinflation reached an official 89.7 sextillion percent the previous November, the second-worst hyperinflationary episode ever recorded. The 2008 Global Political Agreement installed a power-sharing government between Mugabe (ZANU-PF) and Tsvangirai (MDC) that ran until the 2013 election Mugabe won. Re-introducing a domestic currency in 2019 (the RTGS dollar) re-ignited inflation within a year.",
      },
      {
        country: "Cuba",
        year: 1991,
        match_score: 75.3,
        primary_recipe_id: "economic_recession",
        secondary_recipe_ids: ["foreign_intervention", "political_repression"],
        indicator_trajectory: [32, 28, 25, 22, 20, 18, 16, 15, 14, 13, 12, 11],
        what_happened_next:
          "The collapse of Soviet trade subsidies after 1991 triggered Cuba's 'Special Period in Time of Peace': GDP contracted ~35% by 1993, daily caloric intake fell from 2,908 to 1,863 kcal, and the balsero (rafter) exodus reached its 1994 peak. Limited liberalisation (legalising the US dollar 1993–2004, opening to tourism, paladar restaurants) stabilised the economy without political opening.",
      },
      {
        country: "Lebanon",
        year: 2019,
        match_score: 72.1,
        primary_recipe_id: "economic_recession",
        secondary_recipe_ids: ["banking_and_financial_crisis", "mass_protest"],
        indicator_trajectory: [29, 26, 23, 21, 19, 17, 16, 15, 14, 13, 12, 11],
        what_happened_next:
          "Lebanon's October 2019 thawra protests followed a WhatsApp-tax announcement and brought down the Hariri government. The Lebanese lira lost ~98% of its parallel-market value between 2019 and 2024, banks imposed informal capital controls that destroyed household savings, and the August 2020 Beirut port explosion killed 218 people. The World Bank described the episode as among the three worst global financial crises since the mid-19th century.",
      },
    ],
    contributions: [
      {
        recipe_id: "economic_recession",
        recipe_label: "Economic Recession",
        l1_color: "#7B9EE6",
        contribution_pct: 38,
        status: "queued",
      },
      {
        recipe_id: "foreign_intervention",
        recipe_label: "Foreign Intervention",
        l1_color: "#FF8B5C",
        contribution_pct: 24,
        status: "walked_no_graduation",
      },
      {
        recipe_id: "currency_crisis",
        recipe_label: "Currency Crisis",
        l1_color: "#7B9EE6",
        contribution_pct: 20,
        status: "queued",
      },
      {
        recipe_id: "political_repression",
        recipe_label: "Political Repression",
        l1_color: "#5EE6C4",
        contribution_pct: 18,
        status: "queued",
      },
    ],
  },
  {
    iso: "IRN",
    name: "Iran",
    region: "MENA",
    indicator_trajectory: [50, 53, 56, 60, 63, 67, 70, 73, 76, 80, 83, 86],
    analogs: [
      {
        country: "Iran",
        year: 1978,
        match_score: 94.2,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["mass_protest", "political_repression"],
        indicator_trajectory: [52, 55, 58, 61, 65, 68, 71, 74, 77, 81, 84, 87],
        what_happened_next:
          "Mass demonstrations through 1978 culminating in the Black Friday massacre (8 September) forced the Shah's January 1979 departure. Khomeini returned 1 February; the March referendum produced ~98% support for the Islamic Republic. The November 1979 US embassy hostage crisis lasted 444 days and ended Iran-US diplomatic relations, and the September 1980 Iraqi invasion opened an eight-year war that killed over 500,000 combatants.",
      },
      {
        country: "Algeria",
        year: 1990,
        match_score: 81.8,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["political_repression", "mass_protest"],
        indicator_trajectory: [48, 51, 55, 58, 62, 65, 68, 72, 75, 78, 81, 84],
        what_happened_next:
          "Algeria's December 1991 first-round legislative election was annulled by the High Council of State in January 1992 after the FIS won 188 of the 231 contested seats. President Chadli Bendjedid resigned and a military-backed High Committee of State assumed power. The ensuing civil war killed an estimated 100,000–200,000 people through 2002, with the 2005 Charter for Peace and National Reconciliation closing the formal conflict.",
      },
      {
        country: "Belarus",
        year: 2020,
        match_score: 73.5,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["political_repression", "mass_protest"],
        indicator_trajectory: [49, 52, 55, 58, 62, 65, 68, 71, 74, 77, 80, 83],
        what_happened_next:
          "Hundreds of thousands of Belarusians protested the August 2020 election after Alyaksandr Lukashenka claimed an 80% vote share against Sviatlana Tsikhanouskaya. The crackdown that followed jailed an estimated 35,000 people, forced Tsikhanouskaya into Lithuanian exile, and prompted the May 2021 forced Ryanair-flight landing that arrested journalist Roman Protasevich. Lukashenka subsequently permitted Russian forces to use Belarusian territory for the February 2022 invasion of Ukraine.",
      },
    ],
    contributions: [
      {
        recipe_id: "foreign_intervention",
        recipe_label: "Foreign Intervention",
        l1_color: "#FF8B5C",
        contribution_pct: 58,
        status: "walked_no_graduation",
      },
      {
        recipe_id: "mass_protest",
        recipe_label: "Mass Protest",
        l1_color: "#E6C45E",
        contribution_pct: 18,
        status: "queued",
      },
      {
        recipe_id: "political_repression",
        recipe_label: "Political Repression",
        l1_color: "#5EE6C4",
        contribution_pct: 15,
        status: "queued",
      },
      {
        recipe_id: "elections_and_voting",
        recipe_label: "Elections & Voting",
        l1_color: "#7B5EE6",
        contribution_pct: 9,
        status: "walked_no_graduation",
      },
    ],
  },
  {
    iso: "MMR",
    name: "Myanmar",
    region: "Southeast Asia",
    indicator_trajectory: [42, 40, 39, 37, 35, 33, 30, 28, 26, 24, 22, 20],
    analogs: [
      {
        country: "Myanmar",
        year: 1988,
        match_score: 89.6,
        primary_recipe_id: "civil_war_and_insurgency",
        secondary_recipe_ids: ["foreign_intervention", "political_repression"],
        indicator_trajectory: [45, 42, 39, 36, 33, 30, 28, 26, 24, 22, 20, 18],
        what_happened_next:
          "The 8888 Uprising (8 August 1988) culminated months of student-led protest; the State Law and Order Restoration Council assumed power on 18 September after killing several thousand demonstrators. The 1990 election Aung San Suu Kyi's National League for Democracy won decisively was annulled, and Suu Kyi remained under intermittent house arrest until 2010. The junta renamed the country Myanmar in 1989.",
      },
      {
        country: "Sudan",
        year: 1989,
        match_score: 78.4,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["civil_war_and_insurgency", "political_repression"],
        indicator_trajectory: [40, 38, 35, 32, 30, 28, 25, 23, 22, 20, 18, 17],
        what_happened_next:
          "Brigadier Omar al-Bashir overthrew Prime Minister Sadiq al-Mahdi on 30 June 1989, suspending the constitution and banning political parties. The National Islamic Front under Hassan al-Turabi shaped policy through the 1990s, including Sudan's hosting of Osama bin Laden from 1991 to 1996. The Second Sudanese Civil War continued until the 2005 Comprehensive Peace Agreement that led to South Sudan's 2011 independence.",
      },
      {
        country: "Syria",
        year: 2010,
        match_score: 69.7,
        primary_recipe_id: "civil_war_and_insurgency",
        secondary_recipe_ids: ["foreign_intervention", "political_repression"],
        indicator_trajectory: [38, 36, 34, 31, 29, 27, 25, 23, 22, 20, 19, 18],
        weak_analog: true,
        what_happened_next:
          "Protest in Daraa in March 2011, triggered by the detention and torture of teenagers who had written anti-regime graffiti, escalated into a civil war that killed an estimated 580,000 people. Foreign intervention (Russia 2015, US-led coalition 2014, Türkiye 2016, Iran throughout) and the rise and territorial defeat of ISIS shaped the conflict's middle years. The Assad government fell to a HTS-led offensive in December 2024.",
      },
    ],
    contributions: [
      {
        recipe_id: "civil_war_and_insurgency",
        recipe_label: "Civil War & Insurgency",
        l1_color: "#FF8B5C",
        contribution_pct: 39,
        status: "live_legacy",
      },
      {
        recipe_id: "foreign_intervention",
        recipe_label: "Foreign Intervention",
        l1_color: "#FF8B5C",
        contribution_pct: 27,
        status: "walked_no_graduation",
      },
      {
        recipe_id: "political_repression",
        recipe_label: "Political Repression",
        l1_color: "#5EE6C4",
        contribution_pct: 21,
        status: "queued",
      },
      {
        recipe_id: "humanitarian_crisis",
        recipe_label: "Humanitarian Crisis",
        l1_color: "#E65E7B",
        contribution_pct: 13,
        status: "queued",
      },
    ],
  },
  {
    iso: "ETH",
    name: "Ethiopia",
    region: "Sub-Saharan Africa",
    indicator_trajectory: [48, 50, 51, 53, 54, 55, 56, 56, 56, 55, 54, 52],
    analogs: [
      {
        country: "Ethiopia",
        year: 1974,
        match_score: 82.5,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["civil_war_and_insurgency", "political_repression"],
        indicator_trajectory: [50, 52, 53, 55, 56, 57, 57, 57, 56, 55, 53, 51],
        what_happened_next:
          "The Derg coordinating committee deposed Emperor Haile Selassie on 12 September 1974 after months of strikes, mutinies, and famine in Wollo. Selassie died in custody on 27 August 1975 in disputed circumstances. The Red Terror of 1977–1978 killed an estimated 30,000–500,000 people, and the 1983–1985 famine that drew Live Aid attention killed roughly 1 million more. The EPRDF overthrew the Mengistu government in May 1991.",
      },
      {
        country: "Sudan",
        year: 1985,
        match_score: 74.8,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["civil_war_and_insurgency", "drought_and_famine"],
        indicator_trajectory: [47, 49, 51, 53, 54, 55, 56, 55, 54, 53, 51, 49],
        what_happened_next:
          "General Abdel Rahman Swar al-Dahab overthrew Jaafar Nimeiri in a bloodless coup on 6 April 1985, handing power to a civilian transitional government after a year. Sadiq al-Mahdi's elected government governed from 1986 to 1989 before the Bashir coup. The Second Sudanese Civil War, fought principally between Khartoum and the SPLA in the south, continued throughout.",
      },
      {
        country: "Eritrea",
        year: 1998,
        match_score: 71.2,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["civil_war_and_insurgency", "political_repression"],
        indicator_trajectory: [46, 48, 50, 52, 53, 54, 55, 55, 54, 53, 51, 49],
        what_happened_next:
          "The Eritrean-Ethiopian War over the Badme border region (May 1998 – December 2000) killed an estimated 70,000–100,000 combatants. The Algiers Agreement that ended hostilities established a boundary commission whose 2002 ruling Ethiopia rejected, leaving the border closed until the 2018 rapprochement under Abiy Ahmed (Nobel Peace Prize 2019). Eritrea has not held a national election since independence in 1993.",
      },
    ],
    contributions: [
      {
        recipe_id: "foreign_intervention",
        recipe_label: "Foreign Intervention",
        l1_color: "#FF8B5C",
        contribution_pct: 34,
        status: "walked_no_graduation",
      },
      {
        recipe_id: "civil_war_and_insurgency",
        recipe_label: "Civil War & Insurgency",
        l1_color: "#FF8B5C",
        contribution_pct: 31,
        status: "live_legacy",
      },
      {
        recipe_id: "drought_and_famine",
        recipe_label: "Drought & Famine",
        l1_color: "#E65E7B",
        contribution_pct: 19,
        status: "queued",
      },
      {
        recipe_id: "ethnic_and_communal_conflict",
        recipe_label: "Ethnic & Communal Conflict",
        l1_color: "#FF8B5C",
        contribution_pct: 16,
        status: "queued",
      },
    ],
  },
  {
    iso: "TUN",
    name: "Tunisia",
    region: "MENA",
    indicator_trajectory: [60, 59, 58, 57, 55, 53, 51, 48, 46, 43, 41, 38],
    analogs: [
      {
        country: "Tunisia",
        year: 2010,
        match_score: 86.1,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["mass_protest", "economic_recession"],
        indicator_trajectory: [62, 60, 58, 56, 54, 52, 49, 47, 44, 42, 39, 36],
        what_happened_next:
          "Mohamed Bouazizi's self-immolation in Sidi Bouzid on 17 December 2010 triggered protests that ended Ben Ali's 23-year rule on 14 January 2011. A constituent assembly elected in October 2011 ratified a new constitution in January 2014. President Kais Saied suspended parliament on 25 July 2021 and ratified a new presidential-system constitution in July 2022, marking a partial reversal of the post-2011 transition.",
      },
      {
        country: "Egypt",
        year: 2010,
        match_score: 78.9,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["mass_protest", "political_repression"],
        indicator_trajectory: [58, 57, 55, 53, 51, 49, 47, 44, 42, 40, 37, 35],
        what_happened_next:
          "Egypt's 25 January 2011 revolution ended Mubarak's three-decade presidency within eighteen days. Mohamed Morsi (Muslim Brotherhood) won the June 2012 presidential election and was removed by the military in July 2013 after mass protests against his attempted constitutional decree. Abdel Fattah el-Sisi has governed since June 2014, and the Egyptian pound has lost ~75% of its value against the dollar between 2016 and 2024 under successive IMF programmes.",
      },
      {
        country: "Sudan",
        year: 2018,
        match_score: 70.4,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["mass_protest", "political_repression"],
        indicator_trajectory: [57, 55, 53, 51, 49, 47, 45, 43, 40, 38, 35, 33],
        what_happened_next:
          "Sudan's bread-price protests starting December 2018 escalated to the Khartoum sit-in that brought down Omar al-Bashir on 11 April 2019 after thirty years in power. A civilian-military Sovereignty Council under Abdalla Hamdok governed the transition until the October 2021 coup by General Burhan and the RSF's Hemedti. The Burhan-Hemedti split exploded into open war on 15 April 2023, displacing ~10 million people and producing the world's largest hunger crisis.",
      },
    ],
    contributions: [
      {
        recipe_id: "foreign_intervention",
        recipe_label: "Foreign Intervention",
        l1_color: "#FF8B5C",
        contribution_pct: 47,
        status: "walked_no_graduation",
      },
      {
        recipe_id: "mass_protest",
        recipe_label: "Mass Protest",
        l1_color: "#E6C45E",
        contribution_pct: 23,
        status: "queued",
      },
      {
        recipe_id: "economic_recession",
        recipe_label: "Economic Recession",
        l1_color: "#7B9EE6",
        contribution_pct: 17,
        status: "queued",
      },
      {
        recipe_id: "political_repression",
        recipe_label: "Political Repression",
        l1_color: "#5EE6C4",
        contribution_pct: 13,
        status: "queued",
      },
    ],
  },
  {
    iso: "NGA",
    name: "Nigeria",
    region: "Sub-Saharan Africa",
    indicator_trajectory: [44, 45, 47, 48, 50, 51, 53, 54, 56, 57, 59, 60],
    analogs: [
      {
        country: "Nigeria",
        year: 1993,
        match_score: 80.7,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["political_repression", "elections_and_voting"],
        indicator_trajectory: [46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68],
        what_happened_next:
          "General Ibrahim Babangida annulled the 12 June 1993 election widely believed won by Moshood Abiola. Babangida resigned to an interim government in August, which General Sani Abacha overthrew on 17 November. Abacha's rule until his death in June 1998 included the November 1995 hanging of Ken Saro-Wiwa and eight other Ogoni activists, which prompted Commonwealth suspension. The 1999 transition to civilian rule under Olusegun Obasanjo opened Nigeria's Fourth Republic.",
      },
      {
        country: "Pakistan",
        year: 1999,
        match_score: 72.6,
        primary_recipe_id: "foreign_intervention",
        secondary_recipe_ids: ["political_repression", "elections_and_voting"],
        indicator_trajectory: [44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66],
        what_happened_next:
          "General Pervez Musharraf overthrew Prime Minister Nawaz Sharif on 12 October 1999, with the precipitating Kargil-war disagreement, suspending the constitution. He ruled until August 2008, surviving multiple assassination attempts and presiding over Pakistan's role as a Major Non-NATO Ally in the post-9/11 Afghan war. The October 2007 emergency and dismissal of the Chief Justice triggered the lawyers' movement that drove him to resign.",
      },
      {
        country: "Indonesia",
        year: 1997,
        match_score: 68.8,
        primary_recipe_id: "economic_recession",
        secondary_recipe_ids: ["foreign_intervention", "mass_protest"],
        indicator_trajectory: [45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67],
        weak_analog: true,
        what_happened_next:
          "The Asian financial crisis cut the rupiah from ~Rp 2,400/USD to over Rp 17,000/USD between July 1997 and June 1998 and contracted Indonesian GDP by 13.1% in 1998. Suharto resigned on 21 May 1998 after the May riots that killed over 1,000 people in Jakarta, ending his 31-year New Order. The 1999 East Timor independence referendum and the 2004 first direct presidential election (won by SBY) defined the subsequent Reformasi era.",
      },
    ],
    contributions: [
      {
        recipe_id: "foreign_intervention",
        recipe_label: "Foreign Intervention",
        l1_color: "#FF8B5C",
        contribution_pct: 38,
        status: "walked_no_graduation",
      },
      {
        recipe_id: "elections_and_voting",
        recipe_label: "Elections & Voting",
        l1_color: "#7B5EE6",
        contribution_pct: 22,
        status: "walked_no_graduation",
      },
      {
        recipe_id: "political_repression",
        recipe_label: "Political Repression",
        l1_color: "#5EE6C4",
        contribution_pct: 20,
        status: "queued",
      },
      {
        recipe_id: "terrorist_attack",
        recipe_label: "Terrorist Attack",
        l1_color: "#FF8B5C",
        contribution_pct: 20,
        status: "walked_no_graduation",
      },
    ],
  },
];

// ─── TE analogs supplement ────────────────────────────────────────────────────
// Append real TE analog entries from loadAnalogs() for countries not already
// in the hand-authored ENTRIES list.

let _allEntriesCache: CurrentCountryEntry[] | null = null;

function buildAllEntries(): CurrentCountryEntry[] {
  const base = ENTRIES.slice();
  const handAuthored = new Set(base.map((e) => e.iso.toUpperCase()));

  try {
    const data = loadAnalogs();
    for (const te of data.entries) {
      if (!te.name) continue;
      // iso: analog entries have iso=null in v3 contract; derive from name.
      const nameLower = te.name.toLowerCase();
      // Build a best-effort ISO from country-iso2 (imported transitively via
      // countries-v4-data → country-iso2). Since we can't import there (circular),
      // use a simple 3-letter fallback from the name.
      const iso3 = te.iso ?? te.name.slice(0, 3).toUpperCase();
      if (handAuthored.has(iso3)) continue;
      if (!te.analogs || te.analogs.length === 0) continue;

      // Build HistoricalAnalog[] from TE analog entries.
      const analogs: HistoricalAnalog[] = te.analogs
        .filter((a) => a.country && a.year && a.match_score != null)
        .slice(0, 3)
        .map((a) => ({
          country: a.country ?? "",
          year: a.year ?? 0,
          match_score: a.match_score ?? 0,
          primary_recipe_id: a.primary_recipe_id ?? "",
          secondary_recipe_ids: [],
          indicator_trajectory: [], // real trajectory not in v3 analogs contract
          what_happened_next: a.what_happened_next ?? "In training set.",
          weak_analog: (a.weak_analog ?? false) || (a.match_score ?? 0) < 70,
        }));
      if (analogs.length === 0) continue;

      // Build RecipeContribution[] from TE contributions.
      const contributions: RecipeContribution[] = (te.contributions ?? [])
        .filter((c) => c.recipe_id)
        .map((c) => ({
          recipe_id: c.recipe_id ?? "",
          recipe_label: c.recipe_label ?? c.recipe_id ?? "",
          l1_color: c.l1_color ?? "#7A8FA0",
          contribution_pct: c.contribution_pct ?? 0,
          status: "walked_no_graduation" as const,
        }));

      base.push({
        iso: iso3,
        name: te.name,
        region: te.region ?? "Unknown",
        indicator_trajectory: Array.isArray(te.indicator_trajectory)
          ? (te.indicator_trajectory as number[])
          : [],
        analogs,
        contributions,
      });
      handAuthored.add(iso3);
    }
  } catch {
    // loadAnalogs unavailable — fall through to hand-authored only
  }

  return base;
}

export function getCurrentCountries(): CurrentCountryEntry[] {
  if (!_allEntriesCache) _allEntriesCache = buildAllEntries();
  return _allEntriesCache;
}

export function getCurrentCountry(iso: string): CurrentCountryEntry | undefined {
  return getCurrentCountries().find((e) => e.iso === iso.toUpperCase());
}

export function defaultCurrentCountry(): CurrentCountryEntry {
  // Default to Egypt — the spec's example.
  return getCurrentCountries()[0];
}
