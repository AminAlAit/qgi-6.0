import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";
import indexData from "@/data/indexes.json";

const indexByNumericId = new Map<number, { name: string; sector: string; org: string }>();
for (const idx of indexData as {
  numeric_id: number | null;
  name: string;
  sector: string;
  org: string;
}[]) {
  if (idx.numeric_id != null) {
    indexByNumericId.set(idx.numeric_id, {
      name: idx.name,
      sector: idx.sector,
      org: idx.org,
    });
  }
}

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const country_a = searchParams.get("country_a");
  const country_b = searchParams.get("country_b");
  const year_from = searchParams.get("year_from");
  const year_to = searchParams.get("year_to");

  if (!country_a || !country_b) {
    return NextResponse.json(
      { error: "country_a and country_b are required" },
      { status: 400 }
    );
  }

  if (!Number.isFinite(Number(country_a)) || !Number.isFinite(Number(country_b))) {
    return NextResponse.json(
      { error: "Invalid country_a or country_b" },
      { status: 400 }
    );
  }

  if (year_from && !Number.isFinite(Number(year_from))) {
    return NextResponse.json({ error: "Invalid year_from" }, { status: 400 });
  }
  if (year_to && !Number.isFinite(Number(year_to))) {
    return NextResponse.json({ error: "Invalid year_to" }, { status: 400 });
  }

  const conditions = [
    `country_a_id = ${Number(country_a)}`,
    `country_b_id = ${Number(country_b)}`,
  ];
  if (year_from) conditions.push(`start_year_a >= ${Number(year_from)}`);
  if (year_to) conditions.push(`start_year_a <= ${Number(year_to)}`);

  const rows = await runQuery(
    `SELECT indicator_numeric_id, correlation, start_year_a, start_year_b, length
     FROM qgi_data.scdis
     WHERE ${conditions.join(" AND ")}
     ORDER BY CAST(correlation AS DOUBLE) DESC`
  );

  return NextResponse.json(
    rows.map((r) => {
      const numId = Number(r.indicator_numeric_id);
      const meta = indexByNumericId.get(numId);
      return {
        indicator_numeric_id: numId,
        index_name: meta?.name ?? `Indicator #${numId}`,
        sector: meta?.sector ?? "Unknown",
        org: meta?.org ?? "Unknown",
        correlation: Number(r.correlation),
        start_year_a: Number(r.start_year_a),
        start_year_b: Number(r.start_year_b),
        length: Number(r.length),
        predicted: false,
      };
    })
  );
});
