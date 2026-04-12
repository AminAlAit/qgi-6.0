import { NextResponse } from "next/server";
import { loadCountryRisks } from "@/lib/country-risks";

/**
 * GET /api/country-risks
 *
 * Returns the pre-computed country-risks.json from S3 or local fallback.
 * No auth required — data is aggregate risk tiers, not sensitive.
 * Cache for 1 hour at the edge.
 */
export async function GET() {
  try {
    const data = await loadCountryRisks();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 503 }
    );
  }
}
