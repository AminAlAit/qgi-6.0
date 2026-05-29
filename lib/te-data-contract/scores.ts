/**
 * TE sample-10 scores file contract.
 *
 * Source: `data/te-sample-10/scores/{recipe_id}.scores.json`
 * Shape verified from real files at data/te-sample-10/scores/economic_nationalization.scores.json
 */

export interface ShapAttributionEntry {
  code: string;
  /** Resolved server-side; can be null — frontend backfills via lib/indicator-labels.ts. */
  name: string | null;
  signal_share_pct: number;
}

export interface IndicatorMovementEntry {
  code: string;
  /** Resolved server-side; can be null — frontend backfills via lib/indicator-labels.ts. */
  name: string | null;
  /** 12 quarterly z-scored values. */
  trajectory_12q: number[];
  z_score_change: number;
}

export interface NearestAnalogEntry {
  country: string;
  year: number;
  match_score: number;
  weak_analog: boolean;
}

export interface CountryScoreEntry {
  /** null in sample-10 — must be resolved via name-to-ISO map. */
  iso: string | null;
  name: string;
  score: number;
  rank: number;
  eval_year: number;
  in_evidence_base: boolean;
  delta_vs_prior_vintage: number | null;
  shap_attribution: ShapAttributionEntry[];
  indicator_movement: IndicatorMovementEntry[];
  nearest_analogs?: NearestAnalogEntry[];
}

export interface RecipeScoresFile {
  recipe_id: string;
  vintage: string;
  scored_at_utc: string;
  n_countries_scored: number;
  train_auc: number;
  scoring_method: string;
  scores: CountryScoreEntry[];
}
