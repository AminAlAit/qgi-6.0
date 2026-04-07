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
    return NextResponse.json(cached.results, {
      // #144: edge-cache for 24h on CloudFront once Amplify (#102) lands
      headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" },
    });
  }

  // Fallback: query recipes directly.
  // #129: recipes is now pre-deduplicated at source, so the old `MAX(...)
  // GROUP BY recipe_id` collapse step is gone. Ranks by the new normalized
  // 0-100 `pps` column instead of legacy pattern_power_score.
  const currentYear = new Date().getFullYear();
  const rows = await runQuery(
    `WITH ranked AS (
       SELECT r.*,
         ROW_NUMBER() OVER (PARTITION BY r.country_a_id   ORDER BY r.pps DESC) AS country_rank,
         ROW_NUMBER() OVER (PARTITION BY r.event_category ORDER BY r.pps DESC) AS cat_rank
       FROM qgi_data.recipes r
       WHERE r.start_year_b < r.start_year_a
         AND (r.start_year_a + r.length) >= ${currentYear - 2}
         AND (r.start_year_a + r.length) <= ${currentYear + 3}
     )
     SELECT * FROM ranked
     WHERE country_rank <= 3 AND cat_rank <= 10
     ORDER BY pps DESC
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
      instance_count: Number(r.instance_count),
      pattern_power_score: Number(r.pattern_power_score),
      pps: Number(r.pps),
      pattern_tier: r.pattern_tier ?? null,
    }))
  );
});
