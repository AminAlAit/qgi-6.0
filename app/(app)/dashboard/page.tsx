import { DashboardClient } from "./DashboardClient";
import indexData from "@/data/indexes.json";
import type { IndexEntry, PatternRow } from "@/lib/types";

async function fetchRanking(): Promise<PatternRow[]> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/patterns/ranking?limit=1000`, {
      headers: { Authorization: "Bearer __ssr__" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.results ?? [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const patterns = await fetchRanking();
  const indexes = indexData as IndexEntry[];

  return <DashboardClient patterns={patterns} indexes={indexes} />;
}
