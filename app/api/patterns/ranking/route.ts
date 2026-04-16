import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";
import { getDashboardJson, type RankingPayload } from "@/lib/dashboard-cache";

// Dynamic: requires AWS credentials at runtime, cannot prerender at build time.
export const dynamic = "force-dynamic";

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

  // #146: try the pre-computed dashboard JSON first when there are no filters.
  // The pipeline-recipe-engine pre-computes the top 1000 unfiltered patterns
  // on every monthly run. Filtered/paginated requests beyond that fall through to Athena.
  const isUnfiltered = !sector && !min_pps && !min_corr;
  if (isUnfiltered && offset + limit <= 1000) {
    const cached = await getDashboardJson<RankingPayload>("ranking.json");
    if (cached) {
      // #244: dedupe by (country_a, country_b) — keep highest-PPS window per pair.
      // Without this, the top 50 is dominated by overlapping windows of the same
      // South Korea/Thailand precedent (8+ entries differing only by length 49→63).
      // We dedupe on read so the existing pre-computed JSON doesn't need to change.
      const bestPerPair = new Map<string, (typeof cached.results)[number]>();
      for (const row of cached.results) {
        const a = row.country_a_id ?? row.country_a;
        const b = row.country_b_id ?? row.country_b;
        // Order-independent pair key so A→B and B→A collapse together
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const existing = bestPerPair.get(key);
        if (!existing || row.pattern_power_score > existing.pattern_power_score) {
          bestPerPair.set(key, row);
        }
      }
      const deduped = Array.from(bestPerPair.values()).sort(
        (a, b) => b.pattern_power_score - a.pattern_power_score
      );
      return NextResponse.json(
        {
          page,
          limit,
          deduped: true,
          total_unique_pairs: deduped.length,
          results: deduped.slice(offset, offset + limit),
        },
        {
          // #144: edge-cache for 24h on CloudFront once Amplify (#102) lands
          headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" },
        }
      );
    }
    // No cache yet (fresh env or pre-compute failed) — fall through to Athena
  }

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
