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
