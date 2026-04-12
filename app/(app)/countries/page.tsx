import { getCountriesSortedByRisk } from "@/lib/country-risks";
import { CountriesClient } from "@/components/countries/CountriesClient";

export const metadata = {
  title: "Countries — QGI Intelligence",
  description: "Browse country risk profiles powered by historical precedent analysis.",
};

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

  return <CountriesClient countries={countries} />;
}
