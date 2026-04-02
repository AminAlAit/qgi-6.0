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

  const safeA = country_a.replace(/'/g, "''");
  const safeB = country_b.replace(/'/g, "''");
  const lenNum = Number(length);
  const startANum = Number(start_a);
  const startBNum = Number(start_b);

  // Pattern metadata row
  const metaRows = await runQuery(
    `SELECT country_a, country_b, start_year_a, start_year_b, pattern_length,
            avg_correlation, pattern_power_score, num_indexes, predicted
     FROM qgi_data.patterns
     WHERE country_a = '${safeA}'
       AND country_b = '${safeB}'
       AND start_year_a = ${startANum}
       AND start_year_b = ${startBNum}
       AND pattern_length = ${lenNum}
     LIMIT 1`
  );

  if (metaRows.length === 0) {
    return NextResponse.json({ error: "Pattern not found" }, { status: 404 });
  }

  // SCDIs for this pattern
  const scdiRows = await runQuery(
    `SELECT s.index_name, s.sector, s.org, s.correlation,
            s.values_a, s.values_b, s.predicted
     FROM qgi_data.scdis s
     WHERE s.country_a = '${safeA}'
       AND s.country_b = '${safeB}'
       AND s.start_year_a = ${startANum}
       AND s.start_year_b = ${startBNum}
       AND s.pattern_length = ${lenNum}
     ORDER BY CAST(s.correlation AS DOUBLE) DESC`
  );

  const scdis = scdiRows.map((r) => ({
    index_name: r.index_name,
    sector: r.sector,
    org: r.org,
    correlation: Number(r.correlation),
    predicted: r.predicted === "true",
    values_a: JSON.parse(r.values_a ?? "[]"),
    values_b: JSON.parse(r.values_b ?? "[]"),
  }));

  return NextResponse.json({
    metadata: metaRows[0],
    scdis,
  });
});
