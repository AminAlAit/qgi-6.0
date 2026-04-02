import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

export const GET = withAuth(async (req: NextRequest) => {
  const country_a = req.nextUrl.searchParams.get("country_a");
  if (!country_a) {
    return NextResponse.json({ error: "country_a is required" }, { status: 400 });
  }

  const rows = await runQuery(
    `WITH c AS (
       SELECT id, MAX(name_1) AS name FROM qgi_data.countries WHERE name_1 != '' GROUP BY id
     )
     SELECT CAST(p.country_b_id AS VARCHAR) AS country_b_id,
            c.name AS country_b_name,
            array_agg(DISTINCT p.length) AS available_lengths
     FROM qgi_data.patterns p
     LEFT JOIN c ON c.id = CAST(p.country_b_id AS VARCHAR)
     WHERE p.country_a_id = ${Number(country_a)}
     GROUP BY p.country_b_id, c.name
     ORDER BY c.name`
  );

  const result = rows.map((r) => ({
    country_b_id: r.country_b_id,
    country_b_name: r.country_b_name ?? r.country_b_id,
    available_lengths: (r.available_lengths ?? "")
      .replace(/[\[\]\s]/g, "")
      .split(",")
      .map(Number)
      .filter(Boolean)
      .sort((a: number, b: number) => a - b),
  }));

  return NextResponse.json(result);
});
