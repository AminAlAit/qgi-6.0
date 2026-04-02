import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { runQuery } from "@/lib/athena";

export const revalidate = 3600; // 1 hour

export const GET = withAuth(async (_req: NextRequest) => {
  const rows = await runQuery(
    "SELECT id, name_1 AS name, alpha_2 FROM qgi_data.countries ORDER BY name_1"
  );
  // Legacy table has multiple name columns per country — deduplicate by id
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  return NextResponse.json(unique);
});
