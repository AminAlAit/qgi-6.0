/**
 * QGI event-pipeline batch operator — canonical constants, agent output schemas,
 * and the pure consensus function (double-verification design, 2026-07-02).
 *
 * This module is the single source of truth for:
 *   - the 71 canonical layer-3 category codes (mirrors events/taxonomy_hierarchy.json)
 *   - the 8 taxonomy layer-1 shards used by Mode A research fan-out
 *   - verdict vocabularies and CONSENSUS_POLICY (founder gate B1)
 *   - JSON Schemas enforced on every research / curate / verify agent
 *   - recomputeConsensus(), the deterministic consensus rule (§3.3 of the
 *     operator spec) — Python parity copy lives in scripts/validate_verification.py,
 *     kept in lock-step by tests/consensus_vectors.json
 *
 * Used by _lib.mjs (planning/merge CLI) and by workflows via the plan JSON that
 * _lib.mjs renders (workflow scripts are self-contained and receive everything
 * through `args`; they never import this file directly).
 */

// ─── policy & vocabularies ───────────────────────────────────────────────────

// Founder gate B1. "conservative_downgrade" (default): a lone TRUE plus a softer
// pass (PARTIAL/UNCERTAIN) downgrades to the least-confident verdict — if a second
// independent agent couldn't confirm, we don't ship it as ground truth.
// Alternative "majority_overturn": keep the most-confident verdict on soft
// disagreement (TRUE survives unless a majority overturns it). One-constant swap.
export const CONSENSUS_POLICY = "conservative_downgrade";

export const VERDICTS = ["TRUE", "FALSE", "PARTIAL", "UNCERTAIN"];
export const CONSENSUS_VERDICTS = [...VERDICTS, "CONTESTED"];

export const CAPS = {
  COUNTRIES_PER_RUN: 1,
  MAX_NEW_CANDIDATES: 120,   // hard cap across all shards, per Mode A run
  EVENT_BATCH_SIZE: 200,     // Mode B events per run
  SHARD_CONCURRENCY: 4,      // Mode A shard chains in flight
  VERIFIER_CONCURRENCY_A: 2, // parallel blind verifiers per event (Mode A)
  VERIFIER_CONCURRENCY_B: 10, // parallel single-event verifiers (Mode B)
  // /qgi-enrich-events combined-batch defaults (bounded for the ~200-agent-call
  // session-limit ceiling; the recovery pattern handles any overrun):
  ENRICH_MODE_B_CHUNK: 100,  // Mode B events double/triple-verified per enrich run
  TREND_RESEARCH_AGENTS: 4,  // Mode A trend-first: research agents (breadth across regions)
  TREND_CANDIDATES_TARGET: 40 // Mode A trend-first: hard cap on new candidates per run
};

// Mode B escalation ceiling: drive every event to 2 passes, then every event to
// 3 (triple), then stop. plan-b targets the least-verified events first, so 1→2
// completes before any 2→3 begins. Founder rule (2026-07-02): Mode B is
// trend-agnostic + random, double-verify everything, then triple.
export const MAX_VERIFY_DEPTH = 3;

// Trainability thresholds (mirror build_verified_positives.py / build_recipe_manifest.py).
export const RUNNABLE_GATE = 60;
export const THIN_MIN = 8;

// ── active Trends (69) vs event taxonomy (71) ────────────────────────────────
// The taxonomy stays 71 for CURATION/VALIDATION (events of any type still get
// classified). But two Trends are DEACTIVATED from the QGI Trend catalog per the
// charter's endogenous-only rule (founder-authorized 2026-06-20): their onset is
// an exogenous shock, not structurally predictable. Mode A (trend-first enrich)
// selects ONLY from the 69 active Trends — enriching a dead Trend has no value.
export const DEACTIVATED_TRENDS = Object.freeze(["natural_disaster", "epidemic_and_pandemic"]);
// Natural-hazard subtypes remain active Trends but overlap the (deactivated)
// natural_disaster and each other; deprioritized in trend selection (add few NEW
// Trends). Not excluded — just ranked last among active candidates.
export const HAZARD_OVERLAP = Object.freeze([
  "earthquake", "flood_and_cyclone", "volcanic_eruption", "drought_and_famine"
]);

export const TRAIN_WINDOW = [1789, 2021]; // build_verified_positives.py window
export const YEAR_RANGE = [1900, 2030];   // validate_events.py allowed range

// ─── shards: taxonomy layer-1 themes (live taxonomy has 8, ids A–H) ─────────
// NOTE: `sanctions_and_arms_embargo` appears under BOTH D and F in
// taxonomy_hierarchy.json (72 entries, 71 unique codes). For sharding it is
// assigned to D only, so every category belongs to exactly one shard.

export const SHARDS = [
  { id: "A", label: "Political Power & Regime", categories: [
    "elections_and_voting", "government_formation", "constitutional_change",
    "decentralization_and_federalism", "democratic_transition",
    "executive_power_consolidation", "military_coup", "transitional_justice",
    "peacekeeping_and_peace_process"
  ]},
  { id: "B", label: "Conflict & Political Violence", categories: [
    "interstate_war", "civil_war_and_insurgency", "terrorist_attack",
    "foreign_intervention", "ethnic_and_communal_conflict", "political_violence"
  ]},
  { id: "C", label: "State Authority & Governance", categories: [
    "political_repression", "political_corruption", "human_rights_violation",
    "human_rights_reform", "military_policy_and_reform"
  ]},
  { id: "D", label: "Economic & Financial Stress", categories: [
    "currency_crisis", "banking_and_financial_crisis", "economic_recession",
    "fiscal_policy_change", "monetary_policy_change", "economic_liberalization",
    "economic_nationalization", "economic_recovery", "economic_growth_milestone",
    "trade_agreement", "trade_dispute", "foreign_direct_investment",
    "industrial_policy", "sanctions_and_arms_embargo", "foreign_aid_and_development"
  ]},
  { id: "E", label: "Social Mobilization & Civil Society", categories: [
    "mass_protest", "labor_action", "social_policy_reform", "public_health_reform",
    "poverty_and_inequality_crisis", "religious_and_social_movement",
    "migration_and_refugees"
  ]},
  { id: "F", label: "Diplomatic & Geopolitical Relations", categories: [
    "bilateral_treaty", "multilateral_agreement", "diplomatic_rupture",
    "territorial_disputes", "regional_integration"
  ]},
  { id: "G", label: "Humanitarian & Environmental Crisis", categories: [
    "earthquake", "flood_and_cyclone", "volcanic_eruption", "natural_disaster",
    "drought_and_famine", "epidemic_and_pandemic", "humanitarian_crisis",
    "water_crisis"
  ]},
  { id: "H", label: "Structural & Development Context", categories: [
    "energy_policy", "oil_and_gas", "renewable_energy", "environmental_policy",
    "climate_agreement", "resource_conflict", "infrastructure_project",
    "urban_development", "education_reform", "education_and_research",
    "digital_policy", "technology_breakthrough", "cyberattack",
    "cultural_and_heritage", "sport_and_international_event", "agricultural_policy"
  ]}
];

export const CATEGORIES_71 = Object.freeze(SHARDS.flatMap((s) => s.categories));
if (CATEGORIES_71.length !== 71 || new Set(CATEGORIES_71).size !== 71) {
  throw new Error(`CATEGORIES_71 drift: ${CATEGORIES_71.length} entries, ` +
    `${new Set(CATEGORIES_71).size} unique — must both be 71`);
}

/** The 69 active Trends Mode A may enrich (taxonomy 71 minus the 2 deactivated). */
export const ACTIVE_TRENDS = Object.freeze(
  CATEGORIES_71.filter((c) => !DEACTIVATED_TRENDS.includes(c)));

// Force-map for the most common label confabulations (see
// qgi-docs/internal/ops/event-curation-prompt-template.md; full map in
// events/category_mapping.json).
export const CATEGORY_SUBSTITUTIONS = {
  coup: "military_coup",
  ceasefire: "peacekeeping_and_peace_process",
  peace_process: "peacekeeping_and_peace_process",
  peace_agreement: "peacekeeping_and_peace_process",
  protest: "mass_protest",
  assassination: "political_violence",
  independence: "democratic_transition",
  decolonization: "democratic_transition",
  economic_crisis: "economic_recession | currency_crisis | banking_and_financial_crisis (pick the primary driver)",
  sanctions: "sanctions_and_arms_embargo",
  corruption_scandal: "political_corruption",
  refugee_crisis: "migration_and_refugees",
  pandemic: "epidemic_and_pandemic"
};

// ─── join-key normalization (parity with build_verified_positives._norm_title) ─

/** Lowercase, collapse every run of non-[a-z0-9] to a single space, strip.
 * MUST stay byte-identical in behavior to qgi-ml/scripts/
 * build_verified_positives.py::_norm_title — it defines event identity for the
 * curated↔verification join AND for the batch ledgers' dedup keys. */
export function normTitle(title) {
  return String(title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// ─── consensus (deterministic pure code — NEVER an agent decision) ───────────

/**
 * §3.3 consensus rule. `passes` is the append-only verifications[] array;
 * each element carries a `verdict` in VERDICTS.
 * Returns { consensus_verdict, verdict, consensus_status, needs_tiebreak,
 *           had_dissent? } — `verdict` is the legacy-reader alias.
 */
export function recomputeConsensus(passes, policy = CONSENSUS_POLICY) {
  if (!Array.isArray(passes) || passes.length === 0) {
    throw new Error("recomputeConsensus: passes must be a non-empty array");
  }
  const V = passes.map((p) => String(p.verdict).toUpperCase());
  for (const v of V) {
    if (!VERDICTS.includes(v)) throw new Error(`recomputeConsensus: invalid pass verdict ${v}`);
  }
  const n = V.length;
  const T = V.filter((v) => v === "TRUE").length;
  const F = V.filter((v) => v === "FALSE").length;
  const P = V.includes("PARTIAL");
  const uniq = [...new Set(V)];
  const st = (cv, status, tb = false, extra = {}) =>
    ({ consensus_verdict: cv, verdict: cv, consensus_status: status, needs_tiebreak: tb, ...extra });

  if (uniq.length === 1) {                                     // rule 1: unanimous
    return st(V[0], n >= 2 ? (V[0] === "TRUE" ? "double_confirmed" : "double_negative") : "single");
  }
  if (T >= 1 && F >= 1) {                                      // rule 2: hard clash
    if (n <= 2) return st("CONTESTED", "contested_open", true);
    if (T > F)  return st("TRUE", "contested_resolved", false, { had_dissent: true });
    if (F > T)  return st("FALSE", "contested_resolved", false, { had_dissent: true });
    return st("CONTESTED", "contested_open", true);            // T == F, n >= 3
  }
  if (F >= 1) return st("FALSE", "downgraded");                // rule 3: soft, FALSE present (T == 0)
  if (policy === "majority_overturn") {
    // keep the most-confident verdict present on TRUE > PARTIAL > UNCERTAIN
    const cv = T >= 1 ? "TRUE" : (P ? "PARTIAL" : "UNCERTAIN");
    return st(cv, "soft_kept");
  }
  // conservative_downgrade: least-confident present on TRUE > PARTIAL > UNCERTAIN.
  // ({T,P}→PARTIAL; any mix containing UNCERTAIN→UNCERTAIN — the spec TEXT rule;
  // the spec's reference snippet `P ? PARTIAL : UNCERTAIN` contradicts its own
  // {PARTIAL,UNCERTAIN}→UNCERTAIN example and is not followed here.)
  const cv = V.includes("UNCERTAIN") ? "UNCERTAIN" : "PARTIAL";
  return st(cv, "downgraded");
}

// ─── agent output JSON Schemas ───────────────────────────────────────────────

const EVENT_CORE_PROPS = {
  year: { type: "integer", minimum: YEAR_RANGE[0], maximum: YEAR_RANGE[1] },
  title: { type: "string", minLength: 8, maxLength: 120 },
  description: { type: "string", minLength: 40 },
  category: { type: "string", enum: [...CATEGORIES_71] }
};

export const RESEARCH_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates", "categories_valid", "coverage_note"],
  properties: {
    candidates: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["year", "title", "description", "category", "source_url", "confidence"],
        properties: {
          ...EVENT_CORE_PROPS,
          source_url: { type: "string", pattern: "^https?://" },
          confidence: { enum: ["high", "medium", "low"] }
        }
      }
    },
    categories_valid: { const: true }, // self-validation gate: agent asserts every category is in the inline 71-list
    coverage_note: { type: "string" }
  }
};

/** Trend-first research: candidates span MANY countries for ONE Trend, so each
 * carries a `country` slug. category is the target Trend (self-validated). */
export const TREND_RESEARCH_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates", "category_all_match", "coverage_note"],
  properties: {
    candidates: {
      type: "array",
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["country", "year", "title", "description", "category", "source_url", "confidence"],
        properties: {
          country: { type: "string", pattern: "^[a-z_]+$" }, // file slug: lowercase_with_underscores
          ...EVENT_CORE_PROPS,
          source_url: { type: "string", pattern: "^https?://" },
          confidence: { enum: ["high", "medium", "low"] }
        }
      }
    },
    category_all_match: { const: true }, // agent asserts every candidate's category == the target Trend
    coverage_note: { type: "string" }
  }
};

/** Trend-first curate: keeps the country field so merge can route to per-country files. */
export const TREND_CURATE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["curated_events", "dropped", "dedup_report", "all_categories_valid"],
  properties: {
    curated_events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["country", "year", "title", "description", "category"],
        properties: {
          country: { type: "string", pattern: "^[a-z_]+$" },
          ...EVENT_CORE_PROPS
        }
      }
    },
    dropped: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "reason"],
        properties: {
          title: { type: "string" },
          country: { type: "string" },
          year: { type: ["integer", "null"] },
          reason: { enum: ["duplicate_existing", "duplicate_within_batch", "non_event",
                           "wrong_trend", "out_of_range", "low_confidence", "unknown_country"] },
          note: { type: "string" }
        }
      }
    },
    dedup_report: { type: "string" },
    all_categories_valid: { const: true }
  }
};

export const CURATE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["curated_events", "dropped", "dedup_report", "all_categories_valid"],
  properties: {
    curated_events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false, // exactly {year,title,description,category} — never verified/verification_source (#372/#540)
        required: ["year", "title", "description", "category"],
        properties: { ...EVENT_CORE_PROPS }
      }
    },
    dropped: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "reason"],
        properties: {
          title: { type: "string" },
          year: { type: ["integer", "null"] },
          reason: { enum: ["duplicate_existing", "duplicate_within_batch", "non_event",
                           "category_confab", "out_of_range", "low_confidence"] },
          note: { type: "string" }
        }
      }
    },
    dedup_report: { type: "string" },
    all_categories_valid: { const: true }
  }
};

export const VERIFY_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["year", "title", "verdict", "reason", "source", "searched", "corrected_year"],
  properties: {
    year: { type: "integer" },   // echo VERBATIM — join key, never corrected in place
    title: { type: "string" },   // echo VERBATIM — join key
    verdict: { enum: [...VERDICTS] },
    reason: { type: "string", minLength: 20 },
    source: { type: "string" },  // corroborating URL; "" when none found
    searched: { type: "array", items: { type: "string" }, minItems: 1 },
    corrected_year: { type: ["integer", "null"] } // if the true year differs, report here — top-level year stays verbatim
  }
};
