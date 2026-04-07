import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";
import { getIndicatorValuesBatch, type IndicatorRequest } from "@/lib/indicator-values";
import indexData from "@/data/indexes.json";

// Build lookups from numeric_id → metadata and → string ID
const indexByNumericId = new Map<number, { id: string; name: string; sector: string; org: string }>();
for (const idx of indexData as { id: string; numeric_id: number | null; name: string; sector: string; org: string }[]) {
  if (idx.numeric_id != null) {
    indexByNumericId.set(idx.numeric_id, { id: idx.id, name: idx.name, sector: idx.sector, org: idx.org });
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

  const countryAName = metaRows[0].country_a;
  const countryBName = metaRows[0].country_b;

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

  // #148: pre-build the full request list (one per (scdi, side)) and fetch
  // them all in one DDB BatchGetItem instead of N parallel Athena queries.
  // For a 22-indicator pattern this collapses ~44 separate Athena cold
  // starts (3-15s each) into a single sub-second DDB round-trip.
  const requests: IndicatorRequest[] = [];
  const scdiMeta: Array<{ numId: number; indicatorId?: string; correlation: number }> = [];
  for (const r of scdiRows) {
    const numId = Number(r.indicator_numeric_id);
    const meta = indexByNumericId.get(numId);
    const indicatorId = meta?.id;
    scdiMeta.push({ numId, indicatorId, correlation: Number(r.correlation) });
    if (indicatorId && countryAName && countryBName) {
      requests.push({
        indicatorId,
        countryName: countryAName,
        startYear: startANum,
        length: lenNum,
      });
      requests.push({
        indicatorId,
        countryName: countryBName,
        startYear: startBNum,
        length: lenNum,
      });
    }
  }

  const allValues = await getIndicatorValuesBatch(requests);

  const scdis = scdiMeta.map((m, i) => {
    const meta = indexByNumericId.get(m.numId);
    const values_a = m.indicatorId ? allValues[i * 2] ?? [] : [];
    const values_b = m.indicatorId ? allValues[i * 2 + 1] ?? [] : [];
    return {
      indicator_numeric_id: m.numId,
      index_name: meta?.name ?? `Indicator #${m.numId}`,
      sector: meta?.sector ?? "Unknown",
      org: meta?.org ?? "Unknown",
      correlation: m.correlation,
      predicted: false,
      values_a,
      values_b,
    };
  });

  return NextResponse.json({
    metadata: metaRows[0],
    scdis,
  });
});
