/**
 * Supplementary mock data for the /recipe-tracker first-class destination.
 *
 * - HISTORICAL_WALKS: every walk ever fired (real recipe_ids, plausible dates).
 *   Verdicts mirror data/recipe-tracker.json:
 *     foreign_intervention's first walk graduated, then was VACATED 2026-05-25.
 *     terrorist_attack, economic_recession, elections_and_voting HARD_FAIL.
 *     civil_war_and_insurgency legacy ML-1 HARD_FAIL.
 *
 * - IN_FLIGHT: walks currently running (re-walks under the post-vacate
 *   pipeline-coverage fix).
 *
 * - QUEUED_NEXT_30D: recipes scheduled within the next ~30 days.
 *
 * - VACATE_LOG: foreign_intervention 2026-05-25 truncation leak (canonical
 *   honest-correction case; per MEMORY.md project_truncation_leak_crisis).
 *
 * NOT production data; for the /recipe-tracker mockup only.
 */

export interface WalkEvent {
  recipe_id: string;
  fired_at: string; // YYYY-MM-DD
  completed_at?: string;
  verdict: "GRADUATED" | "HARD_FAIL" | "VACATED" | "IN_FLIGHT" | "MARGINAL";
  loco_auc?: number;
}

export interface InFlightItem {
  recipe_id: string;
  started_at: string;
  eta: string;
  stage: string;
  note: string;
}

export interface QueuedItem {
  recipe_id: string;
  eta: string;
}

export interface VacateEvent {
  recipe_id: string;
  label: string;
  prior_status: "graduated" | "directional";
  vacated_at: string;
  cause: string;
  note: string;
}

export const HISTORICAL_WALKS: WalkEvent[] = [
  // Early F-ML-1 dry runs against the four legacy ML-1 recipes
  {
    recipe_id: "civil_war_and_insurgency",
    fired_at: "2026-03-14",
    completed_at: "2026-03-15",
    verdict: "HARD_FAIL",
    loco_auc: 0.7786,
  },
  {
    recipe_id: "elections_and_voting",
    fired_at: "2026-04-02",
    completed_at: "2026-04-03",
    verdict: "HARD_FAIL",
    loco_auc: 0.7085,
  },
  {
    recipe_id: "economic_recession",
    fired_at: "2026-04-18",
    completed_at: "2026-04-19",
    verdict: "HARD_FAIL",
    loco_auc: 0.6978,
  },
  // First successful walk — later vacated
  {
    recipe_id: "foreign_intervention",
    fired_at: "2026-05-12",
    completed_at: "2026-05-13",
    verdict: "GRADUATED",
    loco_auc: 0.9147,
  },
  // Other terminating-event walks
  {
    recipe_id: "terrorist_attack",
    fired_at: "2026-05-18",
    completed_at: "2026-05-19",
    verdict: "HARD_FAIL",
    loco_auc: 0.8862,
  },
  {
    recipe_id: "elections_and_voting",
    fired_at: "2026-05-08",
    completed_at: "2026-05-09",
    verdict: "HARD_FAIL",
    loco_auc: 0.7085,
  },
  // Vacate of the graduate — appears on the timeline as VACATED
  {
    recipe_id: "foreign_intervention",
    fired_at: "2026-05-25",
    completed_at: "2026-05-25",
    verdict: "VACATED",
    loco_auc: 0.5023,
  },
  // Re-walks under the pipeline-coverage fix (in flight at vintage)
  { recipe_id: "foreign_intervention", fired_at: "2026-05-26", verdict: "IN_FLIGHT" },
  { recipe_id: "multilateral_agreement", fired_at: "2026-05-26", verdict: "IN_FLIGHT" },
];

export const IN_FLIGHT: InFlightItem[] = [
  {
    recipe_id: "foreign_intervention",
    started_at: "2026-05-26 04:12 UTC",
    eta: "~5h",
    stage: "Stage 4 / 6",
    note: "Re-validation under the pipeline-coverage fix after the 2026-05-25 correction. Outcome will replace the prior withdrawn result.",
  },
  {
    recipe_id: "multilateral_agreement",
    started_at: "2026-05-26 06:30 UTC",
    eta: "~6h",
    stage: "Stage 2 / 6",
    note: "First validation pass for a Diplomacy-family recipe under the new pipeline-coverage fix.",
  },
];

export const QUEUED_NEXT_30D: QueuedItem[] = [
  { recipe_id: "bilateral_treaty", eta: "2026-06-03" },
  { recipe_id: "mass_protest", eta: "2026-06-09" },
  { recipe_id: "ethnic_and_communal_conflict", eta: "2026-06-15" },
  { recipe_id: "humanitarian_crisis", eta: "2026-06-22" },
  { recipe_id: "human_rights_violation", eta: "2026-06-25" },
];

export const VACATE_LOG: VacateEvent[] = [
  {
    recipe_id: "foreign_intervention",
    label: "Foreign Intervention",
    prior_status: "graduated",
    vacated_at: "2026-05-25",
    cause: "Sample-coverage gap",
    note: "Reported discrimination score 0.9147 on 10 of 174 positives only. Re-evaluated against full history, the score reverts to approximately chance. Graduation was withdrawn publicly; the production rollout was held; a re-validation under the pipeline-coverage fix is in review.",
  },
];
