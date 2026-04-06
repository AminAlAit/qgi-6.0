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

export interface RecipeRow {
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
