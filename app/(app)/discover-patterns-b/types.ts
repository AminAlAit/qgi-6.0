/**
 * Type definitions for /discover-patterns-b (Facets variant).
 * Shared by page.tsx, FacetedGrid, and [slug]/page.tsx.
 */

export type Tier = "STRONG" | "MODERATE" | "MARGINAL";
export type Architecture = "D2" | "D5" | "V1-statistical";
export type RCI = "GREEN" | "YELLOW" | "RED" | "INSUFFICIENT";

export type SortKey =
  | "pps"
  | "avg_correlation"
  | "instance_count"
  | "last_firing_year"
  | "pattern_length";

export interface PatternFacet {
  slug: string;
  display_name: string;
  country_a: string;
  country_a_code: string;
  country_b: string;
  country_b_code: string;
  event_category: string;
  event_label: string;
  l1_category: string;
  l1_label: string;
  tier: Tier;
  architecture: Architecture;
  rci: RCI;
  pps: number;
  avg_correlation: number;
  pattern_length: number;
  start_year_a: number;
  start_year_b: number;
  lead_years: number;
  num_indexes: number;
  region_a: string;
  region_b: string;
  last_firing_year: number;
  instance_count: number;
  /** 7-point correlation trajectory for sparkline rendering. */
  sparkline: number[];
}
