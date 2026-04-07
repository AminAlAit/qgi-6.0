import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";
import { getDashboardJson, type RecipesTop50Payload } from "@/lib/dashboard-cache";

// Recipes top50 updates only on monthly pipeline runs — cache for 24h (#143)
export const revalidate = 86400;

export const GET = withAuth(async (_req: NextRequest) => {
  // #146: try the pre-computed dashboard JSON first.
  const cached = await getDashboardJson<RecipesTop50Payload>("recipes-top50.json");
  if (cached) {
    return NextResponse.json(cached.results);
  }

  // Fallback: query recipes directly
  const currentYear = new Date().getFullYear();

  // The recipes table has massive duplication from the countries LEFT JOIN in the CTAS
  // (countries table has multiple name rows per id). We GROUP BY recipe_id to collapse.
  // Also enforce diversity: max 2 recipes per following-country, max 3 per category.
  const rows = await runQuery(
    `WITH deduped AS (
       SELECT
         recipe_id,
         MAX(event_category) AS event_category,
         MAX(country_a_id) AS country_a_id,
         MAX(country_b_id) AS country_b_id,
         MAX(country_a_name) AS country_a_name,
         MAX(country_b_name) AS country_b_name,
         MAX(start_year_a) AS start_year_a,
         MAX(start_year_b) AS start_year_b,
         MAX(length) AS length,
         MAX(avg_correlation) AS avg_correlation,
         MAX(end_year_a) AS end_year_a,
         MAX(end_year_b) AS end_year_b,
         MAX(event_window) AS event_window,
         MAX(event_year_a) AS event_year_a,
         MAX(event_year_b) AS event_year_b,
         MAX(event_title_a) AS event_title_a,
         MAX(event_title_b) AS event_title_b,
         MAX(indicator_count) AS indicator_count,
         MAX(pattern_power_score) AS pattern_power_score
       FROM qgi_data.recipes
       WHERE start_year_b < start_year_a
         AND (start_year_a + length) >= ${currentYear - 2}
         AND (start_year_a + length) <= ${currentYear + 3}
       GROUP BY recipe_id
     ),
     ranked AS (
       SELECT d.*,
         ROW_NUMBER() OVER (PARTITION BY d.country_a_id ORDER BY d.pattern_power_score DESC) AS country_rank,
         ROW_NUMBER() OVER (PARTITION BY d.event_category ORDER BY d.pattern_power_score DESC) AS cat_rank
       FROM deduped d
     )
     SELECT * FROM ranked
     WHERE country_rank <= 3 AND cat_rank <= 10
     ORDER BY pattern_power_score DESC
     LIMIT 50`
  );

  return NextResponse.json(
    rows.map((r) => ({
      recipe_id: r.recipe_id,
      event_category: r.event_category,
      country_a_id: Number(r.country_a_id),
      country_b_id: Number(r.country_b_id),
      country_a_name: r.country_a_name || `Country ${r.country_a_id}`,
      country_b_name: r.country_b_name || `Country ${r.country_b_id}`,
      start_year_a: Number(r.start_year_a),
      start_year_b: Number(r.start_year_b),
      length: Number(r.length),
      avg_correlation: Number(r.avg_correlation),
      end_year_a: Number(r.end_year_a),
      end_year_b: Number(r.end_year_b),
      event_window: Number(r.event_window),
      event_year_a: Number(r.event_year_a),
      event_year_b: Number(r.event_year_b),
      event_title_a: r.event_title_a,
      event_title_b: r.event_title_b,
      indicator_count: Number(r.indicator_count),
      pattern_power_score: Number(r.pattern_power_score),
    }))
  );
});
