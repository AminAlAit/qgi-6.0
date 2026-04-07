export interface PatternRow {
  country_a: string;
  country_b: string;
  country_a_id?: string;
  country_b_id?: string;
  start_year_a: number;
  start_year_b: number;
  pattern_length: number;
  avg_correlation: number;
  pattern_power_score: number;
  num_indexes: number;
  predicted: boolean;
}

export interface IndexEntry {
  id: string;
  numeric_id: number | null;
  name: string;
  sector: string;
  org: string;
  source: string;
  description: string;
  tips: string;
  citation: string;
}

export interface Country {
  id: string;
  name: string;
  alpha_2: string;
}

/**
 * A "signal" is the user-facing name for an active recipe match in QGI's
 * mental model (#121, 2026-04-07): a country currently following another
 * country's historical trajectory. The underlying database table is still
 * called `recipes` (Athena) — that's the data layer name. Everything the
 * user reads says "signal" or "precedent" instead.
 *
 * SignalRow is the canonical type name. RecipeRow is kept as an alias for
 * backwards compatibility with imports that haven't migrated yet.
 */
export interface SignalRow {
  recipe_id: string;
  event_category: string;
  country_a_id: number;
  country_b_id: number;
  country_a_name: string;
  country_b_name: string;
  start_year_a: number;
  start_year_b: number;
  length: number;
  avg_correlation: number;
  end_year_a: number;
  end_year_b: number;
  event_window: number;
  event_year_a: number;
  event_year_b: number;
  event_title_a: string;
  event_title_b: string;
  indicator_count: number;
  pattern_power_score: number;
  instance_count: number;
}

/** @deprecated Use SignalRow. Kept as an alias during the #121 rename rollout. */
export type RecipeRow = SignalRow;

/**
 * #137: Wrapped API response shape for signal/precedent endpoints.
 *
 * `generated_at` is an ISO timestamp:
 *  - For S3-cached endpoints (top50, ranking, early-warning), it's the moment
 *    `pipeline-recipe-engine` last wrote the dashboard JSON. This means it
 *    reflects the last monthly pipeline run, not the request time.
 *  - For live endpoints (country profile), it's the request time.
 *
 * The frontend uses this for the data freshness UX (DataFreshness component)
 * so users can tell whether they're looking at month-old material or live data.
 */
export interface SignalsResponse {
  generated_at: string;
  results: SignalRow[];
}
