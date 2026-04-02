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
    `SELECT DISTINCT pattern_length
     FROM qgi_data.patterns
     WHERE country_a = '${country_a.replace(/'/g, "''")}'
       AND country_b = '${country_b.replace(/'/g, "''")}'
     ORDER BY pattern_length`
  );

  return NextResponse.json(rows.map((r) => Number(r.pattern_length)));
});
