import { getCountryRisk, loadCountryRisks } from "@/lib/country-risks";
import { PrecedentDetailClient } from "@/components/countries/PrecedentDetailClient";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string; category: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, category } = await params;
  const country = await getCountryRisk(id);
  const name = country?.name ?? `Country #${id}`;
  const catLabel = category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${name} — ${catLabel} — QGI Intelligence`,
    description: `Precedent analysis for ${catLabel} risk in ${name}. Historical analogues and evidence from QGI.`,
  };
}

export default async function PrecedentDetailPage({ params }: Props) {
  const { id, category } = await params;
  const country = await getCountryRisk(id);

  if (!country) {
    return (
      <div className="p-8">
        <p style={{ color: "var(--qgi-text-muted)" }}>Country not found.</p>
      </div>
    );
  }

  let data;
  try {
    data = await loadCountryRisks();
  } catch {
    data = null;
  }

  return (
    <PrecedentDetailClient
      countryId={id}
      country={country}
      category={decodeURIComponent(category)}
      generatedAt={data?.generated_at ?? null}
      version={data?.version ?? "unknown"}
    />
  );
}
