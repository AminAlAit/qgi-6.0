/**
 * Mock recipe data for the /precedents-v2 mockup pages.
 *
 * Combines the real recipe-tracker.json shape (71 recipes, L1 family, status)
 * with mock per-recipe data for the 15 capabilities (indicators, definition,
 * top countries, etc.). NOT production data; for local mockup viewing only.
 *
 * For the foreign_intervention demo case, this module renders the page as
 * if the recipe had cleared a clean re-walk and graduated — to show what
 * a fully-populated 🟢 detail page looks like. Today no recipe is actually
 * graduated.
 */
import recipeTracker from "@/data/recipe-tracker.json";

export type RecipeStatus =
  | "graduated"
  | "walked_no_graduation"
  | "in_progress"
  | "live_legacy"
  | "queued";

export interface TrackerRecipe {
  recipe_id: string;
  label: string;
  l1_id: string;
  l1_label: string;
  l1_color: string;
  l2_label: string;
  status: RecipeStatus;
  stats: {
    loco_auc?: number;
    window_y?: number;
    n_indicators?: number;
    verdict?: string;
  } | null;
}

export interface IndicatorMock {
  code: string;
  name: string;
  provider: string;
}

export interface RecipeMock {
  definition: string;
  indicators: IndicatorMock[];
  window: number;
  countriesTop: Array<{ name: string; score: number }>;
  nPositives?: number;
}

const TRACKER_VINTAGE = (recipeTracker as { generated: string }).generated;

export function vintageStamp(): string {
  return TRACKER_VINTAGE;
}

export function getAllRecipes(): TrackerRecipe[] {
  return (recipeTracker as { recipes: TrackerRecipe[] }).recipes;
}

export function getRecipe(recipeId: string): TrackerRecipe | undefined {
  return getAllRecipes().find((r) => r.recipe_id === recipeId);
}

// Per-recipe mock data. Recipes not listed here fall back to GENERIC_MOCK.
const MOCK_DATA: Record<string, RecipeMock> = {
  elections_and_voting: {
    definition:
      "A national-level electoral event (legislative or presidential) producing a contested or non-contested outcome with implications for regime continuity.",
    indicators: [
      { code: "v2elfrfair", name: "Election free and fair", provider: "V-Dem" },
      { code: "v2elmulpar", name: "Multi-party elections", provider: "V-Dem" },
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
      { code: "v2juncind", name: "Judicial independence", provider: "V-Dem" },
    ],
    window: 3,
    countriesTop: [
      { name: "Tunisia", score: 71.2 },
      { name: "Senegal", score: 68.4 },
      { name: "Brazil", score: 64.8 },
      { name: "South Africa", score: 62.5 },
      { name: "Indonesia", score: 58.7 },
    ],
    nPositives: 865,
  },
  civil_war_and_insurgency: {
    definition:
      "Sustained intra-state armed conflict between a government and one or more organized armed groups, meeting the 1000-battle-deaths-per-year threshold.",
    indicators: [
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
      { code: "v2x_polyarchy", name: "Electoral democracy index", provider: "V-Dem" },
      { code: "v2psoppaut", name: "Opposition autonomy", provider: "V-Dem" },
      {
        code: "NY.GDP.PCAP.KD.ZG",
        name: "GDP per capita growth",
        provider: "World Bank",
      },
    ],
    window: 12,
    countriesTop: [
      { name: "Myanmar", score: 77.8 },
      { name: "Yemen", score: 74.5 },
      { name: "Sudan", score: 71.2 },
      { name: "DRC", score: 68.4 },
      { name: "Mali", score: 64.5 },
    ],
    nPositives: 511,
  },
  foreign_intervention: {
    definition:
      "A foreign state's deployment of military force into another sovereign state's territory, either as direct combat or coercive presence.",
    indicators: [
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
      { code: "v2pepwrgen", name: "Power distributed by gender", provider: "V-Dem" },
      { code: "v2stfisccap", name: "State fiscal source", provider: "V-Dem" },
      {
        code: "v2elintmon",
        name: "International election monitoring",
        provider: "V-Dem",
      },
    ],
    window: 18,
    countriesTop: [
      { name: "Iran", score: 98.1 },
      { name: "Turkmenistan", score: 97.0 },
      { name: "Equatorial Guinea", score: 96.9 },
      { name: "Belarus", score: 94.2 },
      { name: "Tajikistan", score: 88.5 },
    ],
    nPositives: 412,
  },
  terrorist_attack: {
    definition:
      "A coordinated attack by a non-state actor producing civilian casualties or critical-infrastructure damage, meeting GTD/UCDP terrorism criteria.",
    indicators: [
      { code: "v2cseeorgs", name: "CSO entry/exit", provider: "V-Dem" },
      { code: "PV.EST", name: "Political Stability", provider: "World Bank WGI" },
      { code: "v2psoppaut", name: "Opposition autonomy", provider: "V-Dem" },
      { code: "v2x_corr", name: "Political corruption index", provider: "V-Dem" },
    ],
    window: 8,
    countriesTop: [
      { name: "Pakistan", score: 71.5 },
      { name: "Iraq", score: 67.8 },
      { name: "Mali", score: 64.2 },
      { name: "Burkina Faso", score: 61.0 },
      { name: "Nigeria", score: 58.5 },
    ],
    nPositives: 287,
  },
  economic_recession: {
    definition:
      "Two consecutive quarters of negative real GDP growth, or annual real GDP contraction exceeding -1.5%.",
    indicators: [
      { code: "NY.GDP.MKTP.KD.ZG", name: "GDP growth", provider: "World Bank" },
      { code: "FP.CPI.TOTL.ZG", name: "Inflation, CPI", provider: "World Bank" },
      { code: "BX.KLT.DINV.WD.GD.ZS", name: "FDI, net inflows", provider: "World Bank" },
      { code: "SL.UEM.TOTL.ZS", name: "Unemployment", provider: "World Bank ILO" },
    ],
    window: 5,
    countriesTop: [
      { name: "Argentina", score: 72.1 },
      { name: "Turkey", score: 68.5 },
      { name: "Lebanon", score: 65.4 },
      { name: "Sri Lanka", score: 61.8 },
      { name: "Pakistan", score: 58.2 },
    ],
    nPositives: 358,
  },
  bilateral_treaty: {
    definition:
      "A formal agreement between two states governing trade, investment, security, or diplomatic relations.",
    indicators: [
      { code: "v2cltrnslw", name: "Transparent laws", provider: "V-Dem" },
      { code: "BX.KLT.DINV.WD.GD.ZS", name: "FDI, net inflows", provider: "World Bank" },
      { code: "NE.TRD.GNFS.ZS", name: "Trade %GDP", provider: "World Bank" },
      { code: "v2x_polyarchy", name: "Electoral democracy", provider: "V-Dem" },
    ],
    window: 7,
    countriesTop: [
      { name: "Vietnam", score: 64.5 },
      { name: "Morocco", score: 61.8 },
      { name: "Colombia", score: 58.7 },
      { name: "Kazakhstan", score: 56.1 },
      { name: "Egypt", score: 53.2 },
    ],
    nPositives: 563,
  },
  multilateral_agreement: {
    definition:
      "A treaty signed by three or more states, typically through an IGO framework, governing trade, environment, or security.",
    indicators: [
      { code: "v2x_polyarchy", name: "Electoral democracy index", provider: "V-Dem" },
      { code: "NE.TRD.GNFS.ZS", name: "Trade %GDP", provider: "World Bank" },
      { code: "v2cltrnslw", name: "Transparent laws", provider: "V-Dem" },
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
    ],
    window: 9,
    countriesTop: [
      { name: "Costa Rica", score: 72.5 },
      { name: "Chile", score: 68.4 },
      { name: "Uruguay", score: 65.7 },
      { name: "Ireland", score: 63.1 },
      { name: "Estonia", score: 61.8 },
    ],
    nPositives: 287,
  },
  mass_protest: {
    definition:
      "Sustained collective mobilization in public spaces against government policy or leadership, exceeding 1000 participants over multiple days.",
    indicators: [
      { code: "v2x_civlib", name: "Civil liberties index", provider: "V-Dem" },
      { code: "PV.EST", name: "Political Stability", provider: "World Bank" },
      { code: "v2cseeorgs", name: "CSO entry/exit", provider: "V-Dem" },
      { code: "SL.UEM.1524.ZS", name: "Youth unemployment", provider: "World Bank ILO" },
    ],
    window: 5,
    countriesTop: [
      { name: "Iran", score: 72.4 },
      { name: "Chile", score: 65.8 },
      { name: "Lebanon", score: 61.2 },
      { name: "Sudan", score: 58.7 },
      { name: "Hong Kong", score: 55.4 },
    ],
    nPositives: 334,
  },
  political_repression: {
    definition:
      "Sustained government action restricting civil liberties, opposition political activity, or judicial independence.",
    indicators: [
      { code: "v2x_civlib", name: "Civil liberties index", provider: "V-Dem" },
      { code: "v2cseeorgs", name: "CSO entry/exit", provider: "V-Dem" },
      { code: "v2juncind", name: "Judicial independence", provider: "V-Dem" },
      { code: "v2psparban", name: "Party ban", provider: "V-Dem" },
    ],
    window: 6,
    countriesTop: [
      { name: "Belarus", score: 78.2 },
      { name: "Nicaragua", score: 71.4 },
      { name: "Turkmenistan", score: 68.7 },
      { name: "Eritrea", score: 65.1 },
      { name: "Tajikistan", score: 61.8 },
    ],
    nPositives: 373,
  },
  democratic_transition: {
    definition:
      "A sustained shift in the V-Dem electoral democracy index of +0.10 or more over a 5-year window, accompanied by competitive elections.",
    indicators: [
      { code: "v2x_polyarchy", name: "Electoral democracy", provider: "V-Dem" },
      { code: "v2elfrfair", name: "Election free and fair", provider: "V-Dem" },
      { code: "v2x_civlib", name: "Civil liberties", provider: "V-Dem" },
      { code: "v2juncind", name: "Judicial independence", provider: "V-Dem" },
    ],
    window: 6,
    countriesTop: [
      { name: "Tunisia", score: 68.5 },
      { name: "Myanmar (2011-15)", score: 61.4 },
      { name: "Senegal", score: 58.2 },
      { name: "Indonesia", score: 55.7 },
      { name: "Brazil", score: 53.4 },
    ],
    nPositives: 354,
  },
  government_formation: {
    definition:
      "A change of executive government via constitutional process (election, parliamentary vote, succession), excluding coups.",
    indicators: [
      { code: "v2x_polyarchy", name: "Electoral democracy", provider: "V-Dem" },
      { code: "v2elfrfair", name: "Election free and fair", provider: "V-Dem" },
      { code: "v2psoppaut", name: "Opposition autonomy", provider: "V-Dem" },
      { code: "v2psparban", name: "Party ban", provider: "V-Dem" },
    ],
    window: 4,
    countriesTop: [
      { name: "India", score: 65.2 },
      { name: "Mexico", score: 61.7 },
      { name: "Indonesia", score: 58.5 },
      { name: "Spain", score: 56.1 },
      { name: "Italy", score: 54.3 },
    ],
    nPositives: 519,
  },
  constitutional_change: {
    definition: "A formal amendment or wholesale replacement of a national constitution.",
    indicators: [
      {
        code: "v2lginvstp",
        name: "Legislative investigates executive",
        provider: "V-Dem",
      },
      { code: "v2juncind", name: "Judicial independence", provider: "V-Dem" },
      { code: "v2x_polyarchy", name: "Electoral democracy", provider: "V-Dem" },
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank" },
    ],
    window: 6,
    countriesTop: [
      { name: "Chile", score: 58.3 },
      { name: "Tunisia", score: 55.8 },
      { name: "Bolivia", score: 52.4 },
      { name: "Kenya", score: 49.7 },
      { name: "Sri Lanka", score: 47.2 },
    ],
    nPositives: 402,
  },

  // === Additions by Maya Reyes — ~30 more recipes, real V-Dem/WB codes ===
  interstate_war: {
    definition:
      "Armed conflict between two or more sovereign states involving sustained use of military force across a recognized border, meeting UCDP interstate-conflict criteria (≥25 battle deaths per year).",
    indicators: [
      { code: "v2svdomaut", name: "Domestic Autonomy / Sovereignty", provider: "V-Dem" },
      { code: "PV.EST", name: "Political Stability", provider: "World Bank WGI" },
      {
        code: "VC.BTL.DETH",
        name: "Battle-related deaths per 100K",
        provider: "World Bank",
      },
      { code: "v2x_clphy", name: "Physical Violence Index", provider: "V-Dem" },
    ],
    window: 15,
    countriesTop: [
      { name: "Ukraine", score: 84.7 },
      { name: "Armenia", score: 71.3 },
      { name: "Azerbaijan", score: 68.5 },
      { name: "Israel", score: 64.2 },
      { name: "North Korea", score: 58.6 },
    ],
    nPositives: 142,
  },
  ethnic_and_communal_conflict: {
    definition:
      "Sustained organized violence between ethnic, religious, or communal groups producing fatalities and population displacement, distinct from state-versus-rebel civil war dynamics.",
    indicators: [
      {
        code: "v2pepwrses",
        name: "Power Distributed by Social Group (Ethnic)",
        provider: "V-Dem",
      },
      { code: "v2xeg_eqprotec", name: "Equal Protection Index", provider: "V-Dem" },
      {
        code: "VC.IHR.PSRC.P5",
        name: "Intentional homicide rate",
        provider: "World Bank",
      },
      {
        code: "SM.POP.REFG.OR",
        name: "Refugees by country of origin",
        provider: "World Bank",
      },
    ],
    window: 11,
    countriesTop: [
      { name: "Nigeria", score: 74.3 },
      { name: "Myanmar", score: 71.8 },
      { name: "Ethiopia", score: 68.4 },
      { name: "India", score: 61.7 },
      { name: "Sri Lanka", score: 57.2 },
    ],
    nPositives: 268,
  },
  political_violence: {
    definition:
      "Politically motivated violence by state or non-state actors targeting civilians, opposition figures, or political institutions, falling below civil-war intensity thresholds.",
    indicators: [
      { code: "v2x_clphy", name: "Physical Violence Index", provider: "V-Dem" },
      { code: "v2clkill", name: "Freedom from Political Killings", provider: "V-Dem" },
      { code: "PV.EST", name: "Political Stability", provider: "World Bank WGI" },
      { code: "v2csreprss", name: "Civil Society Repression", provider: "V-Dem" },
    ],
    window: 7,
    countriesTop: [
      { name: "Venezuela", score: 73.6 },
      { name: "Mexico", score: 68.1 },
      { name: "Philippines", score: 64.8 },
      { name: "Colombia", score: 61.4 },
      { name: "Honduras", score: 57.9 },
    ],
    nPositives: 487,
  },
  military_coup: {
    definition:
      "Unconstitutional seizure of executive authority by military or security forces, replacing an incumbent civilian or military government within a compressed time window.",
    indicators: [
      { code: "v2x_jucon", name: "Judicial Constraints on Executive", provider: "V-Dem" },
      {
        code: "v2xlg_legcon",
        name: "Legislative Constraints on Executive",
        provider: "V-Dem",
      },
      { code: "v2x_partip", name: "Political Participation", provider: "V-Dem" },
      {
        code: "v2exl_legitlead",
        name: "Legitimacy of Political Leadership",
        provider: "V-Dem",
      },
    ],
    window: 10,
    countriesTop: [
      { name: "Mali", score: 76.4 },
      { name: "Burkina Faso", score: 71.2 },
      { name: "Guinea", score: 67.8 },
      { name: "Niger", score: 64.1 },
      { name: "Sudan", score: 60.5 },
    ],
    nPositives: 187,
  },
  political_corruption: {
    definition:
      "Systemic misuse of public office for private gain by executive, legislative, or judicial officials, evidenced through prosecutions, investigations, or sustained perception declines.",
    indicators: [
      { code: "v2x_corr", name: "Political Corruption Index", provider: "V-Dem" },
      { code: "v2excrptps", name: "Executive Corruption", provider: "V-Dem" },
      { code: "CC.EST", name: "Control of Corruption", provider: "World Bank WGI" },
      { code: "v2x_neopat", name: "Neopatrimonialism Index", provider: "V-Dem" },
    ],
    window: 8,
    countriesTop: [
      { name: "Equatorial Guinea", score: 81.4 },
      { name: "South Sudan", score: 76.8 },
      { name: "Venezuela", score: 71.5 },
      { name: "Turkmenistan", score: 67.2 },
      { name: "Cambodia", score: 63.8 },
    ],
    nPositives: 412,
  },
  human_rights_violation: {
    definition:
      "Documented state or state-tolerated abuses including torture, extrajudicial killing, arbitrary detention, or systematic persecution of identifiable groups.",
    indicators: [
      { code: "v2cltort", name: "Freedom from Torture", provider: "V-Dem" },
      { code: "v2clkill", name: "Freedom from Political Killings", provider: "V-Dem" },
      { code: "v2x_clphy", name: "Physical Violence Index", provider: "V-Dem" },
      { code: "v2xeg_eqprotec", name: "Equal Protection Index", provider: "V-Dem" },
    ],
    window: 7,
    countriesTop: [
      { name: "North Korea", score: 84.6 },
      { name: "Eritrea", score: 78.3 },
      { name: "Syria", score: 74.1 },
      { name: "Iran", score: 68.7 },
      { name: "China", score: 62.4 },
    ],
    nPositives: 524,
  },
  human_rights_reform: {
    definition:
      "Legislative, constitutional, or institutional change expanding civil, political, or minority rights, often following a political transition or sustained civil-society pressure.",
    indicators: [
      { code: "v2x_clpol", name: "Political Civil Liberties Index", provider: "V-Dem" },
      { code: "v2x_clpriv", name: "Private Civil Liberties Index", provider: "V-Dem" },
      { code: "v2juncind", name: "Judicial independence", provider: "V-Dem" },
      { code: "v2cseeorgs", name: "CSO Entry/Exit Freedom", provider: "V-Dem" },
    ],
    window: 9,
    countriesTop: [
      { name: "South Africa", score: 64.8 },
      { name: "Chile", score: 61.2 },
      { name: "Argentina", score: 58.7 },
      { name: "Taiwan", score: 56.3 },
      { name: "Tunisia", score: 53.1 },
    ],
    nPositives: 218,
  },
  military_policy_and_reform: {
    definition:
      "Structural changes to military doctrine, command, conscription, or budget, including civil-military relations reforms following political transition or external pressure.",
    indicators: [
      { code: "v2x_jucon", name: "Judicial Constraints on Executive", provider: "V-Dem" },
      {
        code: "v2xlg_legcon",
        name: "Legislative Constraints on Executive",
        provider: "V-Dem",
      },
      { code: "GE.EST", name: "Government Effectiveness", provider: "World Bank WGI" },
      { code: "PV.EST", name: "Political Stability", provider: "World Bank WGI" },
    ],
    window: 8,
    countriesTop: [
      { name: "Turkey", score: 58.4 },
      { name: "Indonesia", score: 55.1 },
      { name: "Egypt", score: 52.7 },
      { name: "Pakistan", score: 49.8 },
      { name: "Thailand", score: 47.3 },
    ],
    nPositives: 196,
  },
  executive_power_consolidation: {
    definition:
      "A sustained, observable concentration of formal and informal power in the executive at the expense of legislative, judicial, or sub-national institutions, without full regime transition.",
    indicators: [
      { code: "v2x_jucon", name: "Judicial Constraints on Executive", provider: "V-Dem" },
      {
        code: "v2xlg_legcon",
        name: "Legislative Constraints on Executive",
        provider: "V-Dem",
      },
      {
        code: "v2exaphogp",
        name: "Appointment of Head of Government",
        provider: "V-Dem",
      },
      {
        code: "v2lgqstexp",
        name: "Legislature Questions Officials in Practice",
        provider: "V-Dem",
      },
    ],
    window: 11,
    countriesTop: [
      { name: "Hungary", score: 71.4 },
      { name: "Turkey", score: 68.7 },
      { name: "El Salvador", score: 64.3 },
      { name: "India", score: 58.1 },
      { name: "Tunisia", score: 54.6 },
    ],
    nPositives: 234,
  },
  transitional_justice: {
    definition:
      "Formal mechanisms (truth commissions, trials, reparations, lustration) addressing past mass human-rights violations during regime change or post-conflict settlement.",
    indicators: [
      { code: "v2juncind", name: "Judicial independence", provider: "V-Dem" },
      { code: "v2x_rule", name: "Rule of Law Index", provider: "V-Dem" },
      { code: "v2x_polyarchy", name: "Electoral democracy index", provider: "V-Dem" },
      { code: "v2cseeorgs", name: "CSO Entry/Exit Freedom", provider: "V-Dem" },
    ],
    window: 10,
    countriesTop: [
      { name: "Colombia", score: 64.2 },
      { name: "South Africa", score: 61.7 },
      { name: "Argentina", score: 58.4 },
      { name: "Rwanda", score: 54.8 },
      { name: "Cambodia", score: 51.3 },
    ],
    nPositives: 124,
  },
  peacekeeping_and_peace_process: {
    definition:
      "Formal negotiation, ceasefire, or third-party-monitored settlement of an active armed conflict, including deployment of peacekeeping forces under UN, regional, or bilateral mandate.",
    indicators: [
      {
        code: "VC.BTL.DETH",
        name: "Battle-related deaths per 100K",
        provider: "World Bank",
      },
      { code: "v2svdomaut", name: "Domestic Autonomy / Sovereignty", provider: "V-Dem" },
      {
        code: "SM.POP.REFG.OR",
        name: "Refugees by country of origin",
        provider: "World Bank",
      },
      { code: "PV.EST", name: "Political Stability", provider: "World Bank WGI" },
    ],
    window: 12,
    countriesTop: [
      { name: "Colombia", score: 61.5 },
      { name: "Sudan", score: 58.2 },
      { name: "DRC", score: 55.8 },
      { name: "Mali", score: 52.4 },
      { name: "South Sudan", score: 49.7 },
    ],
    nPositives: 168,
  },
  currency_crisis: {
    definition:
      "Sharp depreciation of the national currency exceeding 15% against a reference basket within a 12-month window, often accompanied by reserve depletion and capital controls.",
    indicators: [
      { code: "FP.CPI.TOTL.ZG", name: "Inflation, CPI", provider: "World Bank" },
      {
        code: "DT.DOD.DSTC.ZS",
        name: "Short-term debt % total external",
        provider: "World Bank",
      },
      {
        code: "DT.INT.DECT.GN.ZS",
        name: "Interest on external debt % GNI",
        provider: "World Bank",
      },
      {
        code: "NE.RSB.GNFS.ZS",
        name: "External balance on goods/services % GDP",
        provider: "World Bank",
      },
    ],
    window: 4,
    countriesTop: [
      { name: "Argentina", score: 78.4 },
      { name: "Turkey", score: 71.8 },
      { name: "Lebanon", score: 68.3 },
      { name: "Egypt", score: 61.7 },
      { name: "Pakistan", score: 57.2 },
    ],
    nPositives: 287,
  },
  banking_and_financial_crisis: {
    definition:
      "Systemic banking distress evidenced by NPL ratios above 15%, bank runs, government recapitalization, or deposit insurance activation, distinct from sovereign or currency crises.",
    indicators: [
      {
        code: "FB.AST.NPER.ZS",
        name: "Bank non-performing loans % gross",
        provider: "World Bank",
      },
      { code: "GFDD.DI.01", name: "Bank assets % GDP", provider: "World Bank" },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
      },
      {
        code: "FX.OWN.TOTL.ZS",
        name: "Financial account ownership % pop",
        provider: "World Bank",
      },
    ],
    window: 6,
    countriesTop: [
      { name: "Cyprus", score: 68.4 },
      { name: "Greece", score: 64.7 },
      { name: "Iceland", score: 61.2 },
      { name: "Ukraine", score: 57.8 },
      { name: "Mongolia", score: 53.4 },
    ],
    nPositives: 198,
  },
  fiscal_policy_change: {
    definition:
      "Substantive change to government tax, spending, or borrowing policy, typically codified in a budget law or emergency fiscal package, exceeding a normal annual adjustment.",
    indicators: [
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
      },
      { code: "GE.EST", name: "Government Effectiveness", provider: "World Bank WGI" },
      { code: "v2stfisccap", name: "Fiscal Capacity", provider: "V-Dem" },
      {
        code: "DT.INT.DECT.GN.ZS",
        name: "Interest on external debt % GNI",
        provider: "World Bank",
      },
    ],
    window: 5,
    countriesTop: [
      { name: "Greece", score: 64.1 },
      { name: "Argentina", score: 61.5 },
      { name: "Ecuador", score: 58.2 },
      { name: "Zambia", score: 54.7 },
      { name: "Sri Lanka", score: 51.4 },
    ],
    nPositives: 612,
  },
  monetary_policy_change: {
    definition:
      "Material adjustment to central-bank policy stance — rate cycle inflection, framework switch, or balance-sheet operation — exceeding routine calibration moves.",
    indicators: [
      { code: "FP.CPI.TOTL.ZG", name: "Inflation, CPI", provider: "World Bank" },
      { code: "NY.GDP.MKTP.KD.ZG", name: "GDP growth", provider: "World Bank" },
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
      { code: "GFDD.DI.01", name: "Bank assets % GDP", provider: "World Bank" },
    ],
    window: 4,
    countriesTop: [
      { name: "Turkey", score: 62.7 },
      { name: "Argentina", score: 59.4 },
      { name: "Brazil", score: 54.8 },
      { name: "South Africa", score: 51.2 },
      { name: "Indonesia", score: 48.3 },
    ],
    nPositives: 478,
  },
  economic_liberalization: {
    definition:
      "Policy program reducing state intervention in markets — privatization, deregulation, capital-account opening, or trade liberalization — typically over a multi-year reform window.",
    indicators: [
      { code: "NE.TRD.GNFS.ZS", name: "Trade %GDP", provider: "World Bank" },
      { code: "BX.KLT.DINV.WD.GD.ZS", name: "FDI, net inflows", provider: "World Bank" },
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
      { code: "v2cltrnslw", name: "Transparent laws", provider: "V-Dem" },
    ],
    window: 8,
    countriesTop: [
      { name: "Vietnam", score: 67.5 },
      { name: "India", score: 61.8 },
      { name: "Saudi Arabia", score: 58.4 },
      { name: "Ethiopia", score: 54.2 },
      { name: "Uzbekistan", score: 50.7 },
    ],
    nPositives: 256,
  },
  trade_agreement: {
    definition:
      "Bilateral or multilateral treaty reducing tariff or non-tariff barriers, governing investment, dispute resolution, or services trade, ratified through formal legislative process.",
    indicators: [
      { code: "NE.TRD.GNFS.ZS", name: "Trade %GDP", provider: "World Bank" },
      { code: "BX.KLT.DINV.WD.GD.ZS", name: "FDI, net inflows", provider: "World Bank" },
      { code: "v2cltrnslw", name: "Transparent laws", provider: "V-Dem" },
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
    ],
    window: 6,
    countriesTop: [
      { name: "Vietnam", score: 64.7 },
      { name: "Mexico", score: 61.3 },
      { name: "Chile", score: 58.5 },
      { name: "Singapore", score: 56.2 },
      { name: "Morocco", score: 52.8 },
    ],
    nPositives: 542,
  },
  sanctions_and_arms_embargo: {
    definition:
      "Imposition or lifting of targeted economic, financial, or military restrictions against a country by another state, regional bloc, or UN Security Council resolution.",
    indicators: [
      { code: "v2svdomaut", name: "Domestic Autonomy / Sovereignty", provider: "V-Dem" },
      { code: "NE.TRD.GNFS.ZS", name: "Trade %GDP", provider: "World Bank" },
      { code: "BX.KLT.DINV.WD.GD.ZS", name: "FDI, net inflows", provider: "World Bank" },
      { code: "v2x_polyarchy", name: "Electoral democracy index", provider: "V-Dem" },
    ],
    window: 9,
    countriesTop: [
      { name: "Iran", score: 78.4 },
      { name: "Russia", score: 74.7 },
      { name: "North Korea", score: 71.2 },
      { name: "Venezuela", score: 65.8 },
      { name: "Belarus", score: 61.4 },
    ],
    nPositives: 318,
  },
  economic_recovery: {
    definition:
      "Sustained return to positive real GDP growth following a recession trough, accompanied by labor-market and investment-confidence indicators rejoining their pre-shock trajectories.",
    indicators: [
      { code: "NY.GDP.MKTP.KD.ZG", name: "GDP growth", provider: "World Bank" },
      { code: "SL.UEM.TOTL.ZS", name: "Unemployment", provider: "World Bank ILO" },
      { code: "BX.KLT.DINV.WD.GD.ZS", name: "FDI, net inflows", provider: "World Bank" },
      { code: "GE.EST", name: "Government Effectiveness", provider: "World Bank WGI" },
    ],
    window: 5,
    countriesTop: [
      { name: "Greece", score: 58.2 },
      { name: "Ireland", score: 54.7 },
      { name: "Portugal", score: 51.4 },
      { name: "Spain", score: 48.7 },
      { name: "Iceland", score: 45.3 },
    ],
    nPositives: 387,
  },
  labor_action: {
    definition:
      "Organized work stoppage, general strike, or coordinated industrial action by trade unions or worker collectives, exceeding sectoral or single-employer disputes.",
    indicators: [
      { code: "SL.UEM.TOTL.ZS", name: "Unemployment", provider: "World Bank ILO" },
      {
        code: "v2csprtcpt",
        name: "Civil Society Participatory Environment",
        provider: "V-Dem",
      },
      { code: "SL.UEM.1524.ZS", name: "Youth unemployment", provider: "World Bank ILO" },
      { code: "v2cseeorgs", name: "CSO Entry/Exit Freedom", provider: "V-Dem" },
    ],
    window: 5,
    countriesTop: [
      { name: "France", score: 67.4 },
      { name: "South Africa", score: 61.8 },
      { name: "Argentina", score: 58.2 },
      { name: "Greece", score: 54.7 },
      { name: "India", score: 51.3 },
    ],
    nPositives: 312,
  },
  social_policy_reform: {
    definition:
      "Substantive legislative or regulatory change to welfare, healthcare, pension, or family policy, exceeding routine parametric adjustment.",
    indicators: [
      {
        code: "v2csprtcpt",
        name: "Civil Society Participatory Environment",
        provider: "V-Dem",
      },
      { code: "v2x_polyarchy", name: "Electoral democracy index", provider: "V-Dem" },
      { code: "GE.EST", name: "Government Effectiveness", provider: "World Bank WGI" },
      { code: "SI.POV.GINI", name: "Gini index", provider: "World Bank" },
    ],
    window: 8,
    countriesTop: [
      { name: "Chile", score: 58.4 },
      { name: "Mexico", score: 54.8 },
      { name: "Brazil", score: 51.7 },
      { name: "Spain", score: 48.5 },
      { name: "South Korea", score: 46.2 },
    ],
    nPositives: 421,
  },
  public_health_reform: {
    definition:
      "Major restructuring of national health-system financing, coverage, or delivery, including insurance expansion, pandemic-response architecture, or pharmaceutical regulation.",
    indicators: [
      { code: "GE.EST", name: "Government Effectiveness", provider: "World Bank WGI" },
      { code: "v2x_polyarchy", name: "Electoral democracy index", provider: "V-Dem" },
      { code: "v2cltrnslw", name: "Transparent laws", provider: "V-Dem" },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
      },
    ],
    window: 7,
    countriesTop: [
      { name: "Thailand", score: 56.7 },
      { name: "Mexico", score: 53.4 },
      { name: "Turkey", score: 50.8 },
      { name: "Rwanda", score: 48.1 },
      { name: "Colombia", score: 45.7 },
    ],
    nPositives: 196,
  },
  poverty_and_inequality_crisis: {
    definition:
      "A sustained increase in extreme poverty headcount or Gini coefficient exceeding one standard deviation of the country's historical baseline over a multi-year window.",
    indicators: [
      { code: "SI.POV.GINI", name: "Gini index", provider: "World Bank" },
      {
        code: "SL.EMP.VULN.ZS",
        name: "Vulnerable employment % total",
        provider: "World Bank",
      },
      { code: "SL.UEM.1524.ZS", name: "Youth unemployment", provider: "World Bank" },
      { code: "FP.CPI.TOTL.ZG", name: "Inflation, CPI", provider: "World Bank" },
    ],
    window: 7,
    countriesTop: [
      { name: "South Africa", score: 71.4 },
      { name: "Brazil", score: 64.8 },
      { name: "Honduras", score: 61.2 },
      { name: "Colombia", score: 57.5 },
      { name: "Nigeria", score: 54.1 },
    ],
    nPositives: 287,
  },
  migration_and_refugees: {
    definition:
      "Mass cross-border population movement exceeding 1% of origin- or host-country population, driven by conflict, persecution, economic collapse, or environmental shock.",
    indicators: [
      {
        code: "SM.POP.REFG.OR",
        name: "Refugees by country of origin",
        provider: "World Bank",
      },
      { code: "SM.POP.NETM", name: "Net migration", provider: "World Bank" },
      { code: "v2x_clpriv", name: "Private Civil Liberties Index", provider: "V-Dem" },
      { code: "PV.EST", name: "Political Stability", provider: "World Bank WGI" },
    ],
    window: 8,
    countriesTop: [
      { name: "Syria", score: 81.7 },
      { name: "Venezuela", score: 74.3 },
      { name: "Afghanistan", score: 71.8 },
      { name: "Myanmar", score: 67.5 },
      { name: "South Sudan", score: 63.2 },
    ],
    nPositives: 348,
  },
  religious_and_social_movement: {
    definition:
      "Sustained mobilization around religious identity, moral-traditionalist agenda, or transnational social cause, producing organized advocacy, electoral pressure, or street action.",
    indicators: [
      {
        code: "v2csprtcpt",
        name: "Civil Society Participatory Environment",
        provider: "V-Dem",
      },
      { code: "v2x_clpriv", name: "Private Civil Liberties Index", provider: "V-Dem" },
      { code: "v2cseeorgs", name: "CSO Entry/Exit Freedom", provider: "V-Dem" },
      {
        code: "v2pepwrses",
        name: "Power Distributed by Social Group (Ethnic)",
        provider: "V-Dem",
      },
    ],
    window: 10,
    countriesTop: [
      { name: "India", score: 61.5 },
      { name: "Poland", score: 57.8 },
      { name: "Turkey", score: 54.2 },
      { name: "Brazil", score: 51.4 },
      { name: "United States", score: 48.7 },
    ],
    nPositives: 174,
  },
  diplomatic_rupture: {
    definition:
      "Formal downgrade or severance of diplomatic relations between two states — expulsion of ambassadors, embassy closure, or recognition withdrawal — outside a multilateral context.",
    indicators: [
      { code: "v2svdomaut", name: "Domestic Autonomy / Sovereignty", provider: "V-Dem" },
      { code: "PV.EST", name: "Political Stability", provider: "World Bank WGI" },
      { code: "NE.TRD.GNFS.ZS", name: "Trade %GDP", provider: "World Bank" },
      { code: "v2x_polyarchy", name: "Electoral democracy index", provider: "V-Dem" },
    ],
    window: 6,
    countriesTop: [
      { name: "Russia", score: 71.8 },
      { name: "Iran", score: 68.4 },
      { name: "Venezuela", score: 64.2 },
      { name: "Saudi Arabia", score: 58.7 },
      { name: "Qatar", score: 54.3 },
    ],
    nPositives: 218,
  },
  territorial_disputes: {
    definition:
      "Active contestation of land or maritime boundaries between two or more states, including occupation, claim filings, or military deployments in disputed zones.",
    indicators: [
      { code: "v2svdomaut", name: "Domestic Autonomy / Sovereignty", provider: "V-Dem" },
      { code: "PV.EST", name: "Political Stability", provider: "World Bank WGI" },
      { code: "VC.IDP.NWDS", name: "New internal displacements", provider: "World Bank" },
      { code: "v2x_clphy", name: "Physical Violence Index", provider: "V-Dem" },
    ],
    window: 14,
    countriesTop: [
      { name: "Armenia", score: 71.4 },
      { name: "Azerbaijan", score: 68.7 },
      { name: "Israel", score: 64.2 },
      { name: "India", score: 58.5 },
      { name: "Philippines", score: 54.1 },
    ],
    nPositives: 186,
  },
  regional_integration: {
    definition:
      "Accession, deepening, or institutional reform of a regional intergovernmental organization (EU, ASEAN, AU, Mercosur, ECOWAS) producing binding policy harmonization.",
    indicators: [
      { code: "NE.TRD.GNFS.ZS", name: "Trade %GDP", provider: "World Bank" },
      { code: "v2cltrnslw", name: "Transparent laws", provider: "V-Dem" },
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
      { code: "v2x_polyarchy", name: "Electoral democracy index", provider: "V-Dem" },
    ],
    window: 9,
    countriesTop: [
      { name: "Croatia", score: 61.4 },
      { name: "Albania", score: 57.8 },
      { name: "North Macedonia", score: 54.3 },
      { name: "Serbia", score: 51.7 },
      { name: "Moldova", score: 48.5 },
    ],
    nPositives: 167,
  },
  earthquake: {
    definition:
      "Seismic event of magnitude ≥6.0 producing population casualties or displacement, with humanitarian response triggering domestic emergency declaration or international assistance.",
    indicators: [
      { code: "GE.EST", name: "Government Effectiveness", provider: "World Bank WGI" },
      { code: "VC.IDP.NWDS", name: "New internal displacements", provider: "World Bank" },
      { code: "PV.EST", name: "Political Stability", provider: "World Bank WGI" },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
      },
    ],
    window: 6,
    countriesTop: [
      { name: "Turkey", score: 68.7 },
      { name: "Iran", score: 64.3 },
      { name: "Indonesia", score: 61.8 },
      { name: "Nepal", score: 58.2 },
      { name: "Philippines", score: 54.7 },
    ],
    nPositives: 142,
  },
  epidemic_and_pandemic: {
    definition:
      "Sustained outbreak of a transmissible disease exceeding national baseline mortality or morbidity, triggering WHO PHEIC declaration or domestic public-health emergency.",
    indicators: [
      { code: "GE.EST", name: "Government Effectiveness", provider: "World Bank WGI" },
      { code: "v2cltrnslw", name: "Transparent laws", provider: "V-Dem" },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
      },
      { code: "v2x_polyarchy", name: "Electoral democracy index", provider: "V-Dem" },
    ],
    window: 5,
    countriesTop: [
      { name: "DRC", score: 64.1 },
      { name: "Sierra Leone", score: 58.7 },
      { name: "Guinea", score: 55.2 },
      { name: "Madagascar", score: 51.8 },
      { name: "Yemen", score: 48.4 },
    ],
    nPositives: 118,
  },
  oil_and_gas: {
    definition:
      "Major exploration, production, pricing, or licensing event in the hydrocarbon sector — discovery, project sanction, supply disruption, or fiscal regime change — affecting national revenue.",
    indicators: [
      { code: "NE.TRD.GNFS.ZS", name: "Trade %GDP", provider: "World Bank" },
      { code: "v2x_neopat", name: "Neopatrimonialism Index", provider: "V-Dem" },
      { code: "BX.KLT.DINV.WD.GD.ZS", name: "FDI, net inflows", provider: "World Bank" },
      { code: "v2x_corr", name: "Political Corruption Index", provider: "V-Dem" },
    ],
    window: 10,
    countriesTop: [
      { name: "Venezuela", score: 74.2 },
      { name: "Nigeria", score: 68.5 },
      { name: "Angola", score: 64.7 },
      { name: "Iraq", score: 61.3 },
      { name: "Equatorial Guinea", score: 57.8 },
    ],
    nPositives: 326,
  },
  energy_policy: {
    definition:
      "National-level legislative or executive change governing electricity generation, transmission tariffs, fossil-fuel subsidies, or energy-mix targets, with multi-year sector implications.",
    indicators: [
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
      { code: "GE.EST", name: "Government Effectiveness", provider: "World Bank WGI" },
      { code: "v2cltrnslw", name: "Transparent laws", provider: "V-Dem" },
      { code: "NE.TRD.GNFS.ZS", name: "Trade %GDP", provider: "World Bank" },
    ],
    window: 8,
    countriesTop: [
      { name: "Germany", score: 58.4 },
      { name: "South Africa", score: 54.7 },
      { name: "Indonesia", score: 51.2 },
      { name: "Mexico", score: 48.5 },
      { name: "Egypt", score: 45.8 },
    ],
    nPositives: 234,
  },
  climate_agreement: {
    definition:
      "Ratification, withdrawal, or major NDC update under UNFCCC framework, or signing of regional climate treaty with binding emissions or finance commitments.",
    indicators: [
      { code: "v2cltrnslw", name: "Transparent laws", provider: "V-Dem" },
      { code: "NE.TRD.GNFS.ZS", name: "Trade %GDP", provider: "World Bank" },
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
      { code: "v2x_polyarchy", name: "Electoral democracy index", provider: "V-Dem" },
    ],
    window: 11,
    countriesTop: [
      { name: "Costa Rica", score: 64.7 },
      { name: "Denmark", score: 61.2 },
      { name: "Chile", score: 58.4 },
      { name: "Morocco", score: 54.8 },
      { name: "Bhutan", score: 51.3 },
    ],
    nPositives: 184,
  },
  education_reform: {
    definition:
      "Major change to national curriculum, school financing, teacher policy, or higher-education governance, codified in legislation or ministerial framework.",
    indicators: [
      { code: "GE.EST", name: "Government Effectiveness", provider: "World Bank WGI" },
      { code: "v2x_polyarchy", name: "Electoral democracy index", provider: "V-Dem" },
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
      { code: "v2cltrnslw", name: "Transparent laws", provider: "V-Dem" },
    ],
    window: 9,
    countriesTop: [
      { name: "Chile", score: 58.2 },
      { name: "South Korea", score: 54.7 },
      { name: "Brazil", score: 51.4 },
      { name: "Mexico", score: 48.6 },
      { name: "Indonesia", score: 45.3 },
    ],
    nPositives: 267,
  },
  cyberattack: {
    definition:
      "State-attributed or critical-infrastructure-targeting cyber incident producing service disruption, data exfiltration, or financial loss exceeding national reporting threshold.",
    indicators: [
      { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
      { code: "GE.EST", name: "Government Effectiveness", provider: "World Bank WGI" },
      { code: "v2svdomaut", name: "Domestic Autonomy / Sovereignty", provider: "V-Dem" },
      { code: "PV.EST", name: "Political Stability", provider: "World Bank WGI" },
    ],
    window: 5,
    countriesTop: [
      { name: "Ukraine", score: 71.4 },
      { name: "Estonia", score: 64.7 },
      { name: "Israel", score: 58.3 },
      { name: "South Korea", score: 54.8 },
      { name: "United Kingdom", score: 51.2 },
    ],
    nPositives: 138,
  },
  infrastructure_project: {
    definition:
      "Large-scale capital project (transport corridor, energy plant, port, urban rail) exceeding 1% of GDP or producing cross-border economic linkage, with multi-year implementation arc.",
    indicators: [
      { code: "BX.KLT.DINV.WD.GD.ZS", name: "FDI, net inflows", provider: "World Bank" },
      { code: "GE.EST", name: "Government Effectiveness", provider: "World Bank WGI" },
      { code: "v2x_corr", name: "Political Corruption Index", provider: "V-Dem" },
      {
        code: "GC.DOD.TOTL.GD.ZS",
        name: "Government debt-to-GDP",
        provider: "World Bank",
      },
    ],
    window: 12,
    countriesTop: [
      { name: "Pakistan", score: 61.7 },
      { name: "Kenya", score: 58.4 },
      { name: "Ethiopia", score: 55.1 },
      { name: "Sri Lanka", score: 51.8 },
      { name: "Indonesia", score: 48.4 },
    ],
    nPositives: 318,
  },
};

const GENERIC_INDICATORS: IndicatorMock[] = [
  { code: "v2x_polyarchy", name: "Electoral democracy index", provider: "V-Dem" },
  { code: "RQ.EST", name: "Regulatory Quality", provider: "World Bank WGI" },
  { code: "PV.EST", name: "Political Stability", provider: "World Bank WGI" },
  { code: "NY.GDP.PCAP.KD.ZG", name: "GDP per capita growth", provider: "World Bank" },
];

const GENERIC_COUNTRIES = [
  { name: "Country A", score: 62.5 },
  { name: "Country B", score: 58.4 },
  { name: "Country C", score: 54.7 },
  { name: "Country D", score: 51.2 },
];

export function getMock(recipe: TrackerRecipe): RecipeMock {
  const direct = MOCK_DATA[recipe.recipe_id];
  if (direct) return direct;
  return {
    definition: `${recipe.label}: a structurally-defined event recipe in the QGI catalog. Full definition published with the first walk.`,
    indicators: GENERIC_INDICATORS,
    window: 8,
    countriesTop: GENERIC_COUNTRIES,
    nPositives: undefined,
  };
}

/**
 * Is this recipe rendered as the "demo graduated" case?
 * Foreign Intervention is in walked_no_graduation today (post-vacate), but the
 * spec asks us to show what a graduated page LOOKS like — and foreign_intervention
 * is the natural demo subject.
 */
export function isDemoGraduated(recipe: TrackerRecipe): boolean {
  return recipe.recipe_id === "foreign_intervention";
}
