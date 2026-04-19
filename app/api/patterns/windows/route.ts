import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

/**
 * GET /api/patterns/windows?country_a=<id>&country_b=<id>
 *
 * Returns all pattern windows for a country pair across all lengths.
 * Used by the S2 length range slider in the Patterns browse page.
 *
 * Tries the baked pair-windows/{country_a}.json file first (GH#281),
 * then falls back to a live Athena query.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const country_a = searchParams.get("country_a");
  const country_b = searchParams.get("country_b");
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

  // Try baked per-country file first (instant, zero AWS cost)
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(
      process.cwd(),
      "data",
      "pair-windows",
      `${country_a}.json`
    );
    const raw = await fs.readFile(filePath, "utf-8");
    const countryData = JSON.parse(raw) as Record<
      string,
      {
        top: Array<{
          l: number;
          sa: number;
          sb: number;
          ic: number;
          ac: number;
          pps: number;
        }>;
        hist: Record<string, number>;
      }
    >;
    const pairData = countryData[country_b];
    if (pairData) {
      const result = pairData.top.map((w) => ({
        length: w.l,
        start_year_a: w.sa,
        start_year_b: w.sb,
        num_indexes: w.ic,
        avg_correlation: w.ac,
        pattern_power_score: w.pps,
      }));
      return NextResponse.json(result, {
        headers: { "Cache-Control": "public, max-age=60, s-maxage=3600" },
      });
    }
  } catch {
    // Baked file not found or country_b not in file — fall through to Athena
  }

  // Athena fallback
  const rows = await runQuery(
    `SELECT length, start_year_a, start_year_b, indicator_count, avg_correlation, pattern_power_score
     FROM qgi_data.patterns
     WHERE country_a_id = ${Number(country_a)}
       AND country_b_id = ${Number(country_b)}
     ORDER BY pattern_power_score DESC
     LIMIT 500`
  );

  return NextResponse.json(
    rows.map((r) => ({
      length: Number(r.length),
      start_year_a: Number(r.start_year_a),
      start_year_b: Number(r.start_year_b),
      num_indexes: Number(r.indicator_count),
      avg_correlation: Number(r.avg_correlation),
      pattern_power_score: Number(r.pattern_power_score),
    }))
  );
});
