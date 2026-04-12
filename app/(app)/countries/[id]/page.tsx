import { getCountryRisk, loadCountryRisks } from "@/lib/country-risks";
import { CountryProfileClient } from "@/components/countries/CountryProfileClient";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const country = await getCountryRisk(id);
  const name = country?.name ?? `Country #${id}`;
  return {
    title: `${name} — QGI Intelligence`,
    description: `Risk intelligence profile for ${name} based on historical precedent analysis.`,
  };
}

export default async function CountryProfilePage({ params }: Props) {
  const { id } = await params;
  const country = await getCountryRisk(id);

  if (!country) {
    return (
      <div className="p-8">
        <h1
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Country Not Found
        </h1>
        <p style={{ color: "var(--qgi-text-muted)" }}>
          No risk data available for country ID {id}.
        </p>
      </div>
    );
  }

  // Load metadata for the header
  let data;
  try {
    data = await loadCountryRisks();
  } catch {
    data = null;
  }

  return (
    <CountryProfileClient
      countryId={id}
      country={country}
      generatedAt={data?.generated_at ?? null}
      version={data?.version ?? "unknown"}
    />
  );
}
