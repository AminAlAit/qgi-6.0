import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const countryName = searchParams.get("country");

  if (!countryName) {
    return NextResponse.json({ error: "country parameter required" }, { status: 400 });
  }

  // T9 #302 HIGH fix (2026-04-19): `countryName` was interpolated into
  // Athena SQL with only quote-escape. Tighten the allowed character set
  // too — legitimate country names are letters, spaces, periods, commas,
  // parentheses, apostrophes, hyphens. Anything outside that gets rejected
  // before we build the query. We still quote-escape what remains.
  const SAFE_COUNTRY_NAME = /^[A-Za-z .,()'\-\u00C0-\u024F\u1E00-\u1EFF]{1,100}$/;
  if (!SAFE_COUNTRY_NAME.test(countryName)) {
    return NextResponse.json(
      { error: "Invalid country parameter" },
      { status: 400 }
    );
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

    // #129: recipes is pre-deduplicated at source — no MAX(...) GROUP BY needed.
    // #145: country_a_id is now a partition key, so this WHERE clause prunes
    // to a single partition (~0.5% scan vs 100%).
    const rows = await runQuery(
      `SELECT recipe_id, event_category, country_a_id, country_b_id,
              country_a_name, country_b_name, start_year_a, start_year_b,
              length, avg_correlation, end_year_a, end_year_b, event_window,
              event_year_a, event_year_b, event_title_a, event_title_b,
              indicator_count, instance_count, pattern_power_score, pps, pattern_tier
       FROM qgi_data.recipes
       WHERE country_a_id = ${countryId}
         AND start_year_b < start_year_a
         AND (start_year_a + length) >= ${currentYear - 2}
       ORDER BY pps DESC
       LIMIT 100`
    );

    return NextResponse.json({
      // #137: live Athena query — generated_at is "now". Per-country queries
      // bypass the dashboard JSON cache, so this is always fresh.
      generated_at: new Date().toISOString(),
      results: rows.map((r) => ({
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
        instance_count: Number(r.instance_count),
        pattern_power_score: Number(r.pattern_power_score),
        pps: Number(r.pps),
        pattern_tier: r.pattern_tier ?? null,
      })),
    });
  } catch (err) {
    // T9 #302 HIGH fix: don't leak raw error messages — they may contain
    // S3 bucket names, ARNs, or Athena query text. Log server-side and
    // return a generic 503.
    console.error("Recipe country query failed:", err);
    return NextResponse.json(
      { error: "Recipe data temporarily unavailable" },
      { status: 503 }
    );
  }
});
