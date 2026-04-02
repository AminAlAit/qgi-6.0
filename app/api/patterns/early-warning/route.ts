import { NextRequest, NextResponse } from "next/server";
import { withAuth, requireGroup } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

export const GET = withAuth(async (_req: NextRequest, payload) => {
  requireGroup(payload, "pro");

  const currentYear = new Date().getFullYear();

  const rows = await runQuery(
    `SELECT country_a, country_b, start_year_a, start_year_b, pattern_length,
            avg_correlation, pattern_power_score, num_indexes
     FROM qgi_data.patterns
     WHERE start_year_b < start_year_a
       AND (start_year_a + pattern_length) >= ${currentYear - 2}
     ORDER BY CAST(pattern_power_score AS DOUBLE) DESC`
  );

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      avg_correlation: Number(r.avg_correlation),
      pattern_power_score: Number(r.pattern_power_score),
      num_indexes: Number(r.num_indexes),
    }))
  );
});
