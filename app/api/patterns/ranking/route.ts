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
  // Subquery countries to get one row per id (legacy table has duplicates)
  const rows = await runQuery(
    `WITH c AS (
       SELECT id, MAX(name_1) AS name FROM qgi_data.countries WHERE name_1 != '' GROUP BY id
     )
     SELECT * FROM (
       SELECT ca.name AS country_a, cb.name AS country_b,
              p.start_year_a, p.start_year_b, p.length AS pattern_length,
              p.indicator_count AS num_indexes, p.avg_correlation, p.pattern_power_score,
              CAST(p.country_a_id AS VARCHAR) AS country_a_id,
              CAST(p.country_b_id AS VARCHAR) AS country_b_id,
              ROW_NUMBER() OVER (ORDER BY p.pattern_power_score DESC) AS rn
       FROM qgi_data.patterns p
       LEFT JOIN c ca ON ca.id = CAST(p.country_a_id AS VARCHAR)
       LEFT JOIN c cb ON cb.id = CAST(p.country_b_id AS VARCHAR)
       ${where}
     ) t
     WHERE rn > ${offset} AND rn <= ${offset + limit}
     ORDER BY rn`
  );

  return NextResponse.json({
    page,
    limit,
    results: rows.map((r) => ({
      country_a: r.country_a ?? r.country_a_id,
      country_b: r.country_b ?? r.country_b_id,
      country_a_id: r.country_a_id,
      country_b_id: r.country_b_id,
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
