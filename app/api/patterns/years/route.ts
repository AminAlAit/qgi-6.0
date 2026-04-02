import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const country_a = searchParams.get("country_a");
  const country_b = searchParams.get("country_b");
  const length = searchParams.get("length");
  if (!country_a || !country_b || !length) {
    return NextResponse.json(
      { error: "country_a, country_b, and length are required" },
      { status: 400 }
    );
  }

  const rows = await runQuery(
    `SELECT DISTINCT start_year_a, start_year_b
     FROM qgi_data.patterns
     WHERE country_a_id = ${Number(country_a)}
       AND country_b_id = ${Number(country_b)}
       AND length = ${Number(length)}
     ORDER BY start_year_a, start_year_b`
  );

  return NextResponse.json(
    rows.map((r) => ({
      start_year_a: Number(r.start_year_a),
      start_year_b: Number(r.start_year_b),
    }))
  );
});
