import fs from "fs";
import path from "path";
import { getCountriesSortedByRisk } from "@/lib/country-risks";
import { CountriesClient } from "@/components/countries/CountriesClient";

export const metadata = {
  title: "Countries — QGI Intelligence",
  description: "Browse country risk profiles powered by historical precedent analysis.",
};

/** Load all salience L1 scores server-side and pass to client. */
function loadAllSalienceScores(): Record<string, Record<string, number>> {
  const salienceDir = path.join(process.cwd(), "data", "salience");
  const map: Record<string, Record<string, number>> = {};

  try {
    const files = fs.readdirSync(salienceDir);
    for (const file of files) {
      if (file === "_index.json" || !file.endsWith(".json")) continue;
      const slug = file.replace(".json", "");
      try {
        const raw = fs.readFileSync(path.join(salienceDir, file), "utf-8");
        const data = JSON.parse(raw);
        if (data.l1_scores) {
          map[slug] = data.l1_scores;
        }
      } catch {
        // Skip malformed files
      }
    }
  } catch {
    // Salience dir not available
  }

  return map;
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
            <code className="font-data text-xs">generate_country_risks.py</code>{" "}
            to generate the data.
          </p>
        </div>
      </div>
    );
  }

  const salienceMap = loadAllSalienceScores();

  return <CountriesClient countries={countries} salienceMap={salienceMap} />;
}
