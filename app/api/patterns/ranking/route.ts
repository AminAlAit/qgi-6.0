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

  const rows = await runQuery(
    `SELECT country_a, country_b, start_year_a, start_year_b, pattern_length,
            avg_correlation, pattern_power_score, num_indexes, predicted
     FROM qgi_data.patterns
     ${where}
     ORDER BY CAST(pattern_power_score AS DOUBLE) DESC
     LIMIT ${limit} OFFSET ${offset}`
  );

  return NextResponse.json({
    page,
    limit,
    results: rows.map((r) => ({
      ...r,
      avg_correlation: Number(r.avg_correlation),
      pattern_power_score: Number(r.pattern_power_score),
      num_indexes: Number(r.num_indexes),
      predicted: r.predicted === "true",
    })),
  });
});
