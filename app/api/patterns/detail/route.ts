import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";
import indexData from "@/data/indexes.json";

// Build a lookup from numeric_id → index metadata
const indexByNumericId = new Map<number, { name: string; sector: string; org: string }>();
for (const idx of indexData as { numeric_id: number | null; name: string; sector: string; org: string }[]) {
  if (idx.numeric_id != null) {
    indexByNumericId.set(idx.numeric_id, { name: idx.name, sector: idx.sector, org: idx.org });
  }
}

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
     SELECT ca.name AS country_a, cb.name AS country_b,
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

  // SCDIs for this pattern
  const scdiRows = await runQuery(
    `SELECT s.indicator_numeric_id, s.correlation
     FROM qgi_data.scdis s
     WHERE s.country_a_id = ${aId}
       AND s.country_b_id = ${bId}
       AND s.start_year_a = ${startANum}
       AND s.start_year_b = ${startBNum}
       AND s.length = ${lenNum}
     ORDER BY CAST(s.correlation AS DOUBLE) DESC`
  );

  const scdis = scdiRows.map((r) => {
    const numId = Number(r.indicator_numeric_id);
    const meta = indexByNumericId.get(numId);
    return {
      indicator_numeric_id: numId,
      index_name: meta?.name ?? `Indicator #${numId}`,
      sector: meta?.sector ?? "Unknown",
      org: meta?.org ?? "Unknown",
      correlation: Number(r.correlation),
      predicted: false,
      values_a: [] as number[],
      values_b: [] as number[],
    };
  });

  return NextResponse.json({
    metadata: metaRows[0],
    scdis,
  });
});
