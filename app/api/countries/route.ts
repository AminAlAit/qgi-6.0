import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

export const revalidate = 3600; // 1 hour

export const GET = withAuth(async (_req: NextRequest) => {
  const rows = await runQuery(
    "SELECT DISTINCT country_id AS id, country_name AS name, alpha_2 FROM qgi_data.countries ORDER BY country_name"
  );
  return NextResponse.json(rows);
});
