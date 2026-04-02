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
    `country_a = '${country_a.replace(/'/g, "''")}'`,
    `country_b = '${country_b.replace(/'/g, "''")}'`,
  ];
  if (year_from) conditions.push(`start_year_a >= ${Number(year_from)}`);
  if (year_to) conditions.push(`start_year_a <= ${Number(year_to)}`);

  const rows = await runQuery(
    `SELECT index_name, sector, org, correlation, start_year_a, start_year_b, pattern_length, predicted
     FROM qgi_data.scdis
     WHERE ${conditions.join(" AND ")}
     ORDER BY CAST(correlation AS DOUBLE) DESC`
  );

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      correlation: Number(r.correlation),
      predicted: r.predicted === "true",
    }))
  );
});
