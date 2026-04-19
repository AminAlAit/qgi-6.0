import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

// Try baked country-partners-index.json first, fall back to Athena
export const GET = withAuth(async (req: NextRequest) => {
  const country_a = req.nextUrl.searchParams.get("country_a");
  if (!country_a) {
    return NextResponse.json({ error: "country_a is required" }, { status: 400 });
  }

  if (!Number.isFinite(Number(country_a))) {
    return NextResponse.json({ error: "Invalid country_a" }, { status: 400 });
  }

  // Try baked index first (instant, zero AWS cost)
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const indexPath = path.join(process.cwd(), "data", "country-partners-index.json");
    const raw = await fs.readFile(indexPath, "utf-8");
    const index = JSON.parse(raw) as Record<
      string,
      Array<{
        p: number;
        n: string;
        a2: string;
        w: number;
        pps: number;
        c: number;
        lmin: number;
        lmax: number;
        lc: number;
      }>
    >;
    const partners = index[country_a];
    if (partners) {
      const result = partners.map((p) => ({
        country_b_id: String(p.p),
        country_b_name: p.n,
        alpha2: p.a2,
        window_count: p.w,
        best_pps: p.pps,
        mean_corr: p.c,
        available_lengths: Array.from(
          { length: p.lmax - p.lmin + 1 },
          (_, i) => p.lmin + i
        ),
      }));
      return NextResponse.json(result, {
        headers: { "Cache-Control": "public, max-age=60, s-maxage=3600" },
      });
    }
  } catch {
    // Baked file not found — fall through to Athena
  }

  // Athena fallback
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
