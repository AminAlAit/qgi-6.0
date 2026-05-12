/**
 * Indicator-ID → friendly-name resolver for ML recipe data.
 *
 * Used by `lib/buyer-view.ts` when shaping `top_k_indicators[]` into
 * the `BuyerIndicator[]` shape consumed by the V2 detail page.
 *
 * Background: `data/ml-recipe-stack.json` carries `top_k_indicators` whose
 * `indicator_id` is the raw provider code (World Bank dotted ticker like
 * `VC.BTL.DETH`, V-Dem variable like `v2x_polyarchy`) plus an engineered
 * transform suffix (`__diff`, `__lag`, `__zscore`).
 *
 * Strategy:
 *   1. Strip transform suffix → base code
 *   2. Look up base in `data/indexes.json` (curated 259-entry catalog)
 *   3. Fall back to supplementary map for V-Dem + WB codes not yet in
 *      indexes.json (11 codes used by the 13 LOCKed recipes)
 *   4. Append plain-English transform descriptor
 *   5. If nothing resolves, surface the raw base code rather than crash
 *
 * Long-term plan: the bake script (`qgi-ml/#683`) should write an
 * `indicator_label` field alongside `indicator_id` so this lookup is
 * unnecessary. Until then this is the canonical client-side resolver.
 *
 * Isolated test coverage: `lib/__tests__/indicator-labels.test.ts`.
 */
import indexesData from "@/data/indexes.json";

// ---------------------------------------------------------------------------
// Catalog (indexes.json) — string-id → display name
// ---------------------------------------------------------------------------

const INDEXES_BY_STRING_ID = new Map<string, string>();
for (const idx of indexesData as Array<{ id: string; name: string }>) {
  if (idx.id && idx.name) {
    INDEXES_BY_STRING_ID.set(idx.id, idx.name);
  }
}

// ---------------------------------------------------------------------------
// Supplementary map for codes used by 13 LOCKed ML recipes that are NOT
// in indexes.json. WB + V-Dem catalog names lifted from provider docs.
//
// Audit: this list mirrors what `bake_ml_recipes_for_frontend.py` writes
// today. When a new validated recipe references a fresh indicator not on
// this list, the resolver falls through to the inferred-prefix label
// ("Indicator FOO_BAR") rather than crashing — add the entry here AND
// file a ticket to put it in `qgi-ml/data/indicator-catalog.csv`.
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
// Transform-suffix descriptors
// ---------------------------------------------------------------------------

const TRANSFORM_LABELS: Record<string, string> = {
  __diff: "year-over-year change",
  __lag: "lagged value",
  __zscore: "z-score",
  __change: "change",
  __delta: "delta",
  __momentum: "momentum",
};

// Sort by length descending so `__zscore` matches before a hypothetical `__z`.
const TRANSFORM_SUFFIXES = Object.keys(TRANSFORM_LABELS).sort(
  (a, b) => b.length - a.length
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ResolverResult {
  /** Friendly label, ready to render to users. */
  label: string;
  /** Whether the base code was found in any catalog (true = high-confidence). */
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
 *   resolveIndicatorLabel("VC.BTL.DETH__diff")
 *     → { label: "Battle-related deaths (number of people) (year-over-year change)",
 *         found: true, baseId: "VC.BTL.DETH", transformLabel: "year-over-year change" }
 *
 *   resolveIndicatorLabel("v2x_polyarchy__diff")
 *     → { label: "Electoral democracy index (V-Dem) (year-over-year change)", ... }
 *
 *   resolveIndicatorLabel("UNKNOWN__diff")
 *     → { label: "UNKNOWN (year-over-year change)", found: false, ... }
 *
 *   resolveIndicatorLabel("VC.BTL.DETH")  // no transform
 *     → { label: "Battle-related deaths (number of people)", found: true, ... }
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
  // If no catalog hit, surface the raw base code rather than crash.
  // Analyst readers can still recognize the provider format.
  const namePart = baseName ?? baseId;
  const label = transformLabel ? `${namePart} (${transformLabel})` : namePart;
  return { label, found, baseId, transformLabel };
}

/** Convenience wrapper: just the label string. */
export function getIndicatorLabel(rawId: string): string {
  return resolveIndicatorLabel(rawId).label;
}
