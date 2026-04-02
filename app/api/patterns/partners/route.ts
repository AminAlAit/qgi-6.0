import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

export const GET = withAuth(async (req: NextRequest) => {
  const country_a = req.nextUrl.searchParams.get("country_a");
  if (!country_a) {
    return NextResponse.json({ error: "country_a is required" }, { status: 400 });
  }

  const rows = await runQuery(
    `SELECT country_b AS country_b_id, MAX(country_name) AS country_b_name,
            array_agg(DISTINCT pattern_length) AS available_lengths
     FROM qgi_data.patterns p
     JOIN qgi_data.countries c ON c.country_id = p.country_b
     WHERE country_a = '${country_a.replace(/'/g, "''")}'
     GROUP BY country_b
     ORDER BY country_b_name`
  );

  // available_lengths comes back as a string like "[5, 10, 15]" — parse it
  const result = rows.map((r) => ({
    country_b_id: r.country_b_id,
    country_b_name: r.country_b_name,
    available_lengths: (r.available_lengths ?? "")
      .replace(/[\[\]\s]/g, "")
      .split(",")
      .map(Number)
      .filter(Boolean)
      .sort((a: number, b: number) => a - b),
  }));

  return NextResponse.json(result);
});
