/**
 * Indicator-ID → friendly-name resolver for ML recipe data.
 *
 * Background: `data/ml-recipe-stack.json` carries `top_k_indicators` whose
 * `indicator_id` is the raw provider code (World Bank dotted ticker like
 * `VC.BTL.DETH`, V-Dem variable like `v2x_polyarchy`, etc.) plus an
 * engineered-feature suffix (`__diff`, `__lag`, `__zscore`). Rendering
 * these raw to users is a leak — buyers want "Battle-related deaths
 * (year-over-year change)", not `VC.BTL.DETH__diff`.
 *
 * Strategy:
 *   1. Strip transform suffix → base code
 *   2. Look up base in `data/indexes.json` (curated 259-entry catalog)
 *   3. Fall back to supplementary map for V-Dem variables + WB codes
 *      not yet in indexes.json (11 codes used by 13 LOCKed recipes)
 *   4. Append plain-English transform descriptor
 *
 * Architectural note: long-term, the bake script (qgi-ml) should write an
 * `indicator_label` field alongside `indicator_id` so the frontend doesn't
 * need this lookup. Filed as #683 follow-up.
 */
import indexesData from "@/data/indexes.json";

// ---------------------------------------------------------------------------
// Curated catalog (indexes.json) — string-id → display name
// ---------------------------------------------------------------------------

const INDEXES_BY_STRING_ID = new Map<string, string>();
for (const idx of indexesData as Array<{ id: string; name: string }>) {
  if (idx.id && idx.name) {
    INDEXES_BY_STRING_ID.set(idx.id, idx.name);
  }
}

// ---------------------------------------------------------------------------
// Supplementary map for codes used by the 13 LOCKed ML recipes that are
// NOT in indexes.json yet. World Bank + V-Dem catalog names lifted from
// the providers' authoritative documentation.
//
// Audit: this list mirrors what `bake_ml_recipes_for_frontend.py` writes
// today. When a new LOCKed recipe references a fresh indicator not on
// this list, the resolver falls through to the inferred-prefix label
// rather than crashing — but the result will read "Indicator FOO_BAR"
// instead of the proper name. Add the missing entry here + file the
// real fix as a ticket on `qgi-ml/data/indicator-catalog.csv`.
// ---------------------------------------------------------------------------

const SUPPLEMENTARY_LABELS: Record<string, string> = {
  // ---- World Bank codes missing from indexes.json ----
  "BM.TRF.PWKR.CD.DT": "Personal remittances paid (current US$)",
  "SM.POP.RHCR.EO": "Refugee population by origin",
  "VC.BTL.DETH": "Battle-related deaths (number of people)",
  "VC.IDP.NWDS": "New internally-displaced persons (conflict)",

  // ---- V-Dem variables ----
  v2cacamps: "Political polarization (V-Dem)",
  v2elintmon: "International election monitoring (V-Dem)",
  v2exremhog: "Removal of head of government (V-Dem)",
  v2psprlnks: "Party-society linkages (V-Dem)",
  v2x_jucon: "Judicial constraints on executive (V-Dem)",
  v2x_libdem: "Liberal democracy index (V-Dem)",
  v2x_polyarchy: "Electoral democracy index (V-Dem)",
  v2xlg_legcon: "Legislative constraints on executive (V-Dem)",
};

// ---------------------------------------------------------------------------
// Transform-suffix descriptors. Mapped to user-facing parentheticals so
// the transform isn't a silent context shift.
// ---------------------------------------------------------------------------

const TRANSFORM_LABELS: Record<string, string> = {
  __diff: "year-over-year change",
  __lag: "lagged value",
  __zscore: "z-score",
  __change: "change",
  __delta: "delta",
  __momentum: "momentum",
};

// Order matters: longest suffix first so `__zscore` doesn't accidentally match
// before `__z`. (None currently overlap, but defensive.)
const TRANSFORM_SUFFIXES = Object.keys(TRANSFORM_LABELS).sort(
  (a, b) => b.length - a.length
);

// ---------------------------------------------------------------------------
// Core resolver
// ---------------------------------------------------------------------------

interface ResolverResult {
  /** Friendly label, ready to render to users. */
  label: string;
  /** Whether the base code was found in any catalog (true = confident). */
  found: boolean;
  /** Base code with transform stripped. */
  baseId: string;
  /** Transform suffix in plain English, or `""` if no transform. */
  transformLabel: string;
}

/**
 * Resolve a raw indicator id to a buyer-facing label.
 *
 * Examples:
 *   getIndicatorLabel("VC.BTL.DETH__diff")
 *     → "Battle-related deaths (year-over-year change)"
 *   getIndicatorLabel("v2x_polyarchy__diff")
 *     → "Electoral democracy index (V-Dem) (year-over-year change)"
 *   getIndicatorLabel("UNKNOWN.NEW.CODE__diff")
 *     → "UNKNOWN.NEW.CODE (year-over-year change)"  ← graceful fallback
 *   getIndicatorLabel("VC.BTL.DETH")
 *     → "Battle-related deaths (number of people)"   ← no transform
 */
export function resolveIndicatorLabel(rawId: string): ResolverResult {
  let baseId = rawId;
  let transformLabel = "";
  for (const suffix of TRANSFORM_SUFFIXES) {
    if (rawId.endsWith(suffix)) {
      baseId = rawId.slice(0, -suffix.length);
      transformLabel = TRANSFORM_LABELS[suffix] ?? "";
      break;
    }
  }
  const fromIndexes = INDEXES_BY_STRING_ID.get(baseId);
  const fromSupplementary = SUPPLEMENTARY_LABELS[baseId];
  const baseName = fromIndexes ?? fromSupplementary;
  const found = baseName !== undefined;
  // If no catalog hit, surface the raw base code rather than crash —
  // analyst readers can still recognize the provider format. Less
  // user-friendly, but never silently empty.
  const namePart = baseName ?? baseId;
  const label = transformLabel ? `${namePart} (${transformLabel})` : namePart;
  return { label, found, baseId, transformLabel };
}

/**
 * Convenience wrapper for the common case: just want the label string.
 */
export function getIndicatorLabel(rawId: string): string {
  return resolveIndicatorLabel(rawId).label;
}
