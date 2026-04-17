import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

/**
 * GET /api/patterns/windows?country_a=<id>&country_b=<id>
 *
 * Returns all pattern windows for a country pair across all lengths.
 * Used by the S2 length range slider in the Patterns browse page.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const country_a = searchParams.get("country_a");
  const country_b = searchParams.get("country_b");
  if (!country_a || !country_b) {
    return NextResponse.json(
      { error: "country_a and country_b are required" },
      { status: 400 }
    );
  }

  const rows = await runQuery(
    `SELECT length, start_year_a, start_year_b, num_indexes, avg_correlation, pattern_power_score
     FROM qgi_data.patterns
     WHERE country_a_id = ${Number(country_a)}
       AND country_b_id = ${Number(country_b)}
     ORDER BY pattern_power_score DESC`
  );

  return NextResponse.json(
    rows.map((r) => ({
      length: Number(r.length),
      start_year_a: Number(r.start_year_a),
      start_year_b: Number(r.start_year_b),
      num_indexes: Number(r.num_indexes),
      avg_correlation: Number(r.avg_correlation),
      pattern_power_score: Number(r.pattern_power_score),
    }))
  );
});
