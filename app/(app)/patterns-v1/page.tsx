import { Suspense } from "react";
import type { Metadata } from "next";
import PatternsClient from "./PatternsClient";
import type { PatternRow } from "@/lib/types";

// T19 #312: patterns discovery page metadata. Previously shared root title.
export const metadata: Metadata = {
  title: "Patterns · QGI Intelligence",
  description:
    "Explore statistically-significant indicator patterns between country pairs. Discover which economies walked the same trajectory.",
  // #699: canonical points to V3 counterpart; explicit noindex (defense in
  // depth atop robots.ts Disallow).
  alternates: { canonical: "/patterns" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "Patterns · QGI Intelligence",
    description:
      "Explore statistically-significant indicator patterns between country pairs.",
    url: "https://qgintelligence.com/patterns-v1",
    siteName: "QGI Intelligence",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Patterns · QGI Intelligence",
    description:
      "Explore statistically-significant indicator patterns between country pairs.",
  },
};

// T6 #299 + T16 #309 HIGH: the S0 landing pane shows top 10 unique pairs.
// Previously the client fetched `/api/patterns/ranking?limit=1000` on mount
// to compute them, pulling 1000 rows over the wire just to display 10.
// Read the baked ranking.json server-side and pass top 10 as an initial
// prop — identical data, zero client fetch, zero Athena cost.
export const revalidate = 3600;

async function loadInitialTopPairs(): Promise<PatternRow[]> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "ranking.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const json: unknown = JSON.parse(raw);
    if (
      !json ||
      typeof json !== "object" ||
      !Array.isArray((json as { results?: unknown }).results)
    ) {
      return [];
    }
    const rows: PatternRow[] = (json as { results: PatternRow[] }).results;
    // Sonnet P1-4 fix (2026-04-19): zero-padded numeric-string key so
    // "10|2" vs "2|10" dedup matches numeric ordering. Otherwise the same
    // pair dedups inconsistently depending on where ids come from.
    const padKey = (v: string | number | undefined, fallback: string) => {
      const n = Number(v);
      return Number.isFinite(n) ? String(n).padStart(6, "0") : String(v ?? fallback);
    };
    const bestPerPair = new Map<string, PatternRow>();
    for (const row of rows) {
      const a = padKey(row.country_a_id, row.country_a);
      const b = padKey(row.country_b_id, row.country_b);
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const existing = bestPerPair.get(key);
      if (!existing || row.pattern_power_score > existing.pattern_power_score) {
        bestPerPair.set(key, row);
      }
    }
    return Array.from(bestPerPair.values())
      .sort((a, b) => b.pattern_power_score - a.pattern_power_score)
      .slice(0, 10);
  } catch {
    return [];
  }
}

export default async function PatternsPage() {
  const initialTopPairs = await loadInitialTopPairs();
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center h-full text-xs tracking-wider"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          LOADING…
        </div>
      }
    >
      <PatternsClient initialTopPairs={initialTopPairs} />
    </Suspense>
  );
}
