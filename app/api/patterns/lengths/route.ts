import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const country_a = searchParams.get("country_a");
  const country_b = searchParams.get("country_b");
  if (!country_a || !country_b) {
    return NextResponse.json({ error: "country_a and country_b are required" }, { status: 400 });
  }

  const rows = await runQuery(
    `SELECT DISTINCT length
     FROM qgi_data.patterns
     WHERE country_a_id = ${Number(country_a)}
       AND country_b_id = ${Number(country_b)}
     ORDER BY length`
  );

  return NextResponse.json(rows.map((r) => Number(r.length)));
});
