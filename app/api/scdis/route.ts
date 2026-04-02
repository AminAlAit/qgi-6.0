import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const country_a = searchParams.get("country_a");
  const country_b = searchParams.get("country_b");
  const year_from = searchParams.get("year_from");
  const year_to = searchParams.get("year_to");

  if (!country_a || !country_b) {
    return NextResponse.json({ error: "country_a and country_b are required" }, { status: 400 });
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
    rows.map((r) => ({
      indicator_numeric_id: Number(r.indicator_numeric_id),
      index_name: `Indicator #${r.indicator_numeric_id}`,
      sector: "Unknown",
      org: "Unknown",
      correlation: Number(r.correlation),
      start_year_a: Number(r.start_year_a),
      start_year_b: Number(r.start_year_b),
      length: Number(r.length),
      predicted: false,
    }))
  );
});
