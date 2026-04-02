import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const country_a = searchParams.get("country_a");
  const country_b = searchParams.get("country_b");
  const start_a = searchParams.get("start_a");
  const start_b = searchParams.get("start_b");
  const length = searchParams.get("length");

  if (!country_a || !country_b || !start_a || !start_b || !length) {
    return NextResponse.json(
      { error: "country_a, country_b, start_a, start_b, and length are required" },
      { status: 400 }
    );
  }

  const aId = Number(country_a);
  const bId = Number(country_b);
  const lenNum = Number(length);
  const startANum = Number(start_a);
  const startBNum = Number(start_b);

  // Pattern metadata row (join deduplicated countries for names)
  const metaRows = await runQuery(
    `WITH c AS (
       SELECT id, MAX(name_1) AS name FROM qgi_data.countries WHERE name_1 != '' GROUP BY id
     )
     SELECT CAST(p.country_a_id AS VARCHAR) AS country_a,
            CAST(p.country_b_id AS VARCHAR) AS country_b,
            ca.name AS country_a_name, cb.name AS country_b_name,
            p.start_year_a, p.start_year_b, p.length AS pattern_length,
            p.avg_correlation, p.pattern_power_score,
            p.indicator_count AS num_indexes
     FROM qgi_data.patterns p
     LEFT JOIN c ca ON ca.id = CAST(p.country_a_id AS VARCHAR)
     LEFT JOIN c cb ON cb.id = CAST(p.country_b_id AS VARCHAR)
     WHERE p.country_a_id = ${aId}
       AND p.country_b_id = ${bId}
       AND p.start_year_a = ${startANum}
       AND p.start_year_b = ${startBNum}
       AND p.length = ${lenNum}
     LIMIT 1`
  );

  if (metaRows.length === 0) {
    return NextResponse.json({ error: "Pattern not found" }, { status: 404 });
  }

  // SCDIs for this pattern — legacy scdis table has limited columns
  const scdiRows = await runQuery(
    `SELECT s.indicator_numeric_id, s.correlation,
            s.country_a_id, s.country_b_id,
            s.start_year_a, s.start_year_b, s.length
     FROM qgi_data.scdis s
     WHERE s.country_a_id = ${aId}
       AND s.country_b_id = ${bId}
       AND s.start_year_a = ${startANum}
       AND s.start_year_b = ${startBNum}
       AND s.length = ${lenNum}
     ORDER BY CAST(s.correlation AS DOUBLE) DESC`
  );

  const scdis = scdiRows.map((r) => ({
    indicator_numeric_id: Number(r.indicator_numeric_id),
    index_name: `Indicator #${r.indicator_numeric_id}`,
    sector: "Unknown",
    org: "Unknown",
    correlation: Number(r.correlation),
    predicted: false,
    values_a: [],
    values_b: [],
  }));

  return NextResponse.json({
    metadata: metaRows[0],
    scdis,
  });
});
