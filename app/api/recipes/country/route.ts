import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const countryName = searchParams.get("country");

  if (!countryName) {
    return NextResponse.json({ error: "country parameter required" }, { status: 400 });
  }

  const currentYear = new Date().getFullYear();
  const safe = countryName.replace(/'/g, "''");

  try {
    // First resolve the country name to an ID
    const countryRows = await runQuery(
      `SELECT CAST(id AS INTEGER) AS cid FROM qgi_data.countries
       WHERE LOWER(name_1) = LOWER('${safe}') LIMIT 1`
    );

    if (countryRows.length === 0) {
      return NextResponse.json([]);
    }

    const countryId = countryRows[0].cid;

    // GROUP BY recipe_id to collapse country-name-variant duplicates
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
         WHERE country_a_id = ${countryId}
           AND start_year_b < start_year_a
           AND (start_year_a + length) >= ${currentYear - 2}
         GROUP BY recipe_id
       )
       SELECT * FROM deduped
       ORDER BY pattern_power_score DESC
       LIMIT 100`
    );

    return NextResponse.json(
      rows.map((r) => ({
        recipe_id: r.recipe_id,
        event_category: r.event_category,
        country_a_id: Number(r.country_a_id),
        country_b_id: Number(r.country_b_id),
        country_a_name: r.country_a_name || countryName,
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
  } catch (err) {
    console.error("Recipe country query failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Query failed" },
      { status: 500 }
    );
  }
});
