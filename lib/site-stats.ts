/**
 * Site-wide marketing/methodology statistics — single source of truth (#431).
 *
 * The QA sweep on 2026-04-24 found 5 different country counts (197, 214, 89)
 * and 2 different indicator counts (58, 69) sprinkled across landing,
 * methodology, dashboard, layout metadata, and JSON-LD — all on neighbouring
 * surfaces of the same site. Marketing copy was hardcoded in each location,
 * which made even a one-time correction painful and a recurring fact-check
 * impossible.
 *
 * This module is the ONE place where pipeline-scope numbers live. Every
 * surface that renders a stat about "QGI scale" should import from here.
 *
 * The constants below have been triangulated against:
 *   - qgi-docs/architecture/pipeline-phases.md     ("58 indicators, 214 countries")
 *   - qgi-docs/architecture/system-overview.md     ("58 indicators")
 *   - qgi-docs/internal/testing/persona-panel-2026-04-18.md ("214 countries, 58 indicators")
 *   - qgi-docs/external/articles/serbia-eu-candidate-high-risk-short.md
 *   - qgi-docs/external/reports/fsi-demo-april-2026.md
 *
 * Disambiguation: 58 ≠ 74. The pipeline currently SCORES 58 indicators
 * (z-score + RRF). The CATALOG holds 74 (69 World Bank + 5 FAO). Surfaces
 * that talk about "data we use" use 58; the methodology page can reference
 * the catalog separately when explaining the roadmap.
 *
 * "Scored this cycle" (89 in V1.9.1) is loaded dynamically from
 * country-risks.json and is NOT a constant — see `getScoredThisCycle()`.
 */

import type { CountryRisksData } from "./country-risks";

/**
 * Number of countries in pipeline scope (qgi_data.countries Athena table).
 * Includes historical/dissolved states; this is the denominator the SCDI
 * grid is computed against.
 */
export const TOTAL_COUNTRIES = 214;

/**
 * Number of indicators currently SCORED by the pipeline (z-score + RRF).
 * Subset of the catalog (TOTAL_INDICATOR_CATALOG) — the rest are awaiting
 * ingestion, normalization, or re-validation.
 */
export const TOTAL_INDICATORS = 104;

/**
 * Total indicators in the catalog. Founder-confirmed 2026-05-22: the
 * pipeline actively scores 104 indicators (was 58 in earlier vintage).
 * Catalog must be at least the scored count; keeping equal until a
 * fresh audit produces a verified larger total.
 */
export const TOTAL_INDICATOR_CATALOG = 104;

/**
 * UN-recognized states. Constant scope descriptor — appears in marketing
 * copy that frames "global coverage" rather than pipeline arithmetic.
 */
export const UN_STATES = 197;

/**
 * SCDI rows in the master grid (Pearson |r| >= 0.7). 14.3B as of the V1.8.1
 * pipeline run. The next regen will refresh this; bumping requires a
 * coordinated update with the methodology blog post.
 */
export const TOTAL_SCDIS = "14.3B";

/**
 * Patterns computed by the V1.9 backtest (recipe windows × predicted vs
 * actual). 2.01B as of qgi-ml/backtest_v19_results.json.
 */
export const TOTAL_PATTERNS = "2.01B";

/**
 * Scoring version currently live on qgintelligence.com.
 */
export const SCORING_VERSION = "V1.9.1";

/**
 * Current data vintage (max year in the World Bank data we ingested).
 */
export const DATA_VINTAGE_YEAR = 2024;

/**
 * Canonical one-line scope sentence used in OG/social/meta descriptions.
 * Reusing this string — rather than copying it five times — keeps the
 * count drift QA caught from re-emerging.
 *
 * 2026-05-24: "economic data" → "open-source indicators" (qgi-aws-tf#877).
 * The indicator panel spans V-Dem governance/regime + FAOSTAT + ILOSTAT
 * + World Bank, not solely economic data; OSINT framing matches the rest
 * of the public surface.
 */
export const CANONICAL_SCOPE_SENTENCE = `Historical precedents across ${TOTAL_COUNTRIES} countries and ${TOTAL_INDICATORS} open-source indicators.`;

/**
 * Number of recipes currently LOCKed by the ML pipeline. Used by the
 * dashboard's recipe-progress display + the methodology page's stat
 * cards. 13 LOCKed as of 2026-05-21 (post-KI-2 amendment; territorial_
 * disputes was FALSIFIED). foreign_intervention graduated 2026-05-23 via
 * the F-ML-1 similarity-as-risk layer (separate from LOCK count which
 * is the calibrated-classifier dive).
 *
 * Update when a recipe is added to or removed from the LOCK set. CI
 * assertion in lib/__tests__/site-stats.test.ts will fail if this drifts
 * from the recipe manifest (TODO #878 follow-up).
 */
export const TOTAL_LOCKED = 13;

/**
 * Read the count of countries that received a risk tier in the current
 * pipeline cycle from country-risks.json. This is data-driven (it
 * fluctuates between cycles as more countries clear the scoring floor).
 */
export function getScoredThisCycle(data: CountryRisksData): number {
  return Object.values(data.countries).filter((c) => c.overall_risk_tier).length;
}
