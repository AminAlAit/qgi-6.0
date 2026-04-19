import path from "path";
import { getCountriesSortedByRisk } from "@/lib/country-risks";
import { CountriesClient } from "@/components/countries/CountriesClient";
import type { Metadata } from "next";

// T16 #309 HIGH fix: revalidate every hour so we don't re-read 198 files
// + re-parse the 2.6 MB country-risks.json on every request. The salience
// files rarely change intra-day.
export const revalidate = 3600;

// T19 #312: add canonical + openGraph so /countries has a proper social
// preview rather than inheriting the root layout defaults.
export const metadata: Metadata = {
  title: "Countries — QGI Intelligence",
  description:
    "Browse country risk profiles powered by historical precedent analysis across 197 countries.",
  alternates: { canonical: "https://qgintelligence.com/countries" },
  openGraph: {
    title: "Countries — QGI Intelligence",
    description:
      "Browse country risk profiles powered by historical precedent analysis across 197 countries.",
    url: "https://qgintelligence.com/countries",
    siteName: "QGI Intelligence",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Countries — QGI Intelligence",
    description: "Browse country risk profiles powered by historical precedent analysis.",
  },
};

/**
 * Load all salience L1 scores server-side.
 *
 * T16 #309 HIGH fix: was `fs.readdirSync` + `fs.readFileSync` in a 198-file
 * loop on every request — blocked the event loop and dominated TTFB on
 * /countries. Now uses async `fs/promises`, parallelizes file reads, and
 * memoizes at module scope keyed by `_index.json` mtime so repeated
 * requests within an ISR window skip the work entirely.
 */
let _salienceCache: {
  mtimeMs: number;
  data: Record<string, Record<string, number>>;
} | null = null;

async function loadAllSalienceScores(): Promise<Record<string, Record<string, number>>> {
  const fs = await import("fs/promises");
  const salienceDir = path.join(process.cwd(), "data", "salience");

  try {
    // Use _index.json mtime as the cache key — salience files are written
    // as a batch so they share a mtime, and _index.json is always present.
    const indexStat = await fs.stat(path.join(salienceDir, "_index.json"));
    if (_salienceCache && _salienceCache.mtimeMs === indexStat.mtimeMs) {
      return _salienceCache.data;
    }

    const files = (await fs.readdir(salienceDir)).filter(
      (f) => f !== "_index.json" && f.endsWith(".json")
    );
    const entries = await Promise.all(
      files.map(async (file) => {
        try {
          const raw = await fs.readFile(path.join(salienceDir, file), "utf-8");
          const data = JSON.parse(raw) as { l1_scores?: Record<string, number> };
          if (!data.l1_scores) return null;
          return [file.replace(".json", ""), data.l1_scores] as const;
        } catch {
          return null; // skip malformed files
        }
      })
    );
    const map: Record<string, Record<string, number>> = {};
    for (const e of entries) if (e) map[e[0]] = e[1];

    _salienceCache = { mtimeMs: indexStat.mtimeMs, data: map };
    return map;
  } catch {
    return _salienceCache?.data ?? {};
  }
}

export default async function CountriesPage() {
  let countries: Awaited<ReturnType<typeof getCountriesSortedByRisk>> = [];
  let error: string | null = null;

  try {
    countries = await getCountriesSortedByRisk();
  } catch (err) {
    error = (err as Error).message;
  }

  if (error) {
    return (
      <div className="p-8">
        <h1
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Countries
        </h1>
        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <p style={{ color: "var(--qgi-text-muted)" }}>
            Country risk data not yet available. Run{" "}
            <code className="font-data text-xs">generate_country_risks.py</code> to
            generate the data.
          </p>
        </div>
      </div>
    );
  }

  const salienceMap = await loadAllSalienceScores();

  return <CountriesClient countries={countries} salienceMap={salienceMap} />;
}
