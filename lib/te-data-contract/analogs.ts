/**
 * TE sample-10 analogs contract.
 *
 * Source: `data/te-sample-10/analogs/current-state-analogs.json`
 * Shape verified from real files.
 */

export interface AnalogEntry {
  country: string;
  year: number;
  match_score: number;
  primary_recipe_id: string;
  what_happened_next: string | null;
  weak_analog: boolean;
}

export interface AnalogContributionEntry {
  recipe_id: string;
  recipe_label: string;
  l1_color: string;
  contribution_pct: number;
  status: string;
}

export interface CurrentStateAnalogEntry {
  /** null in sample-10 — resolve via name-to-ISO map. */
  iso: string | null;
  name: string;
  /** null in sample-10. */
  region: string | null;
  /** null in sample-10 — represents per-indicator trajectory; not yet emitted. */
  indicator_trajectory: unknown | null;
  analogs: AnalogEntry[];
  contributions: AnalogContributionEntry[];
}

export interface CurrentStateAnalogs {
  vintage: string;
  entries: CurrentStateAnalogEntry[];
}
