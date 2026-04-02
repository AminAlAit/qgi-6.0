import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit") ?? DEFAULT_LIMIT)));
  const sector = searchParams.get("sector");
  const min_pps = searchParams.get("min_pps");
  const min_corr = searchParams.get("min_corr");
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  if (sector) conditions.push(`sector = '${sector.replace(/'/g, "''")}'`);
  if (min_pps) conditions.push(`CAST(pattern_power_score AS DOUBLE) >= ${Number(min_pps)}`);
  if (min_corr) conditions.push(`CAST(avg_correlation AS DOUBLE) >= ${Number(min_corr)}`);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Athena (Presto) does not support OFFSET — use ROW_NUMBER() for pagination
  const rows = await runQuery(
    `SELECT * FROM (
       SELECT country_a_id AS country_a, country_b_id AS country_b,
              start_year_a, start_year_b, length AS pattern_length,
              indicator_count AS num_indexes, avg_correlation, pattern_power_score,
              ROW_NUMBER() OVER (ORDER BY pattern_power_score DESC) AS rn
       FROM qgi_data.patterns
       ${where}
     ) t
     WHERE rn > ${offset} AND rn <= ${offset + limit}
     ORDER BY rn`
  );

  return NextResponse.json({
    page,
    limit,
    results: rows.map((r) => ({
      country_a: r.country_a,
      country_b: r.country_b,
      start_year_a: Number(r.start_year_a),
      start_year_b: Number(r.start_year_b),
      pattern_length: Number(r.pattern_length),
      avg_correlation: Number(r.avg_correlation),
      pattern_power_score: Number(r.pattern_power_score),
      num_indexes: Number(r.num_indexes),
      predicted: false,
    })),
  });
});
