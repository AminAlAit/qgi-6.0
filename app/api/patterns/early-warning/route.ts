import { NextRequest, NextResponse } from "next/server";
import { withAuth, requireGroup } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

export const GET = withAuth(async (_req: NextRequest, payload) => {
  requireGroup(payload, "pro");

  const currentYear = new Date().getFullYear();

  const rows = await runQuery(
    `WITH c AS (
       SELECT id, MAX(name_1) AS name FROM qgi_data.countries WHERE name_1 != '' GROUP BY id
     )
     SELECT ca.name AS country_a, cb.name AS country_b,
            p.start_year_a, p.start_year_b, p.length AS pattern_length,
            p.avg_correlation, p.pattern_power_score,
            p.indicator_count AS num_indexes
     FROM qgi_data.patterns p
     LEFT JOIN c ca ON ca.id = CAST(p.country_a_id AS VARCHAR)
     LEFT JOIN c cb ON cb.id = CAST(p.country_b_id AS VARCHAR)
     WHERE p.start_year_b < p.start_year_a
       AND (p.start_year_a + p.length) >= ${currentYear - 2}
     ORDER BY p.pattern_power_score DESC`
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
