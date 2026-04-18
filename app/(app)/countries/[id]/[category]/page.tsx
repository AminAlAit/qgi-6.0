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

/**
 * Load analogues for a specific country-category from baked analogues.json.
 */
async function loadAnalogues(
  countryId: string,
  category: string
): Promise<Array<{ country_b_id: number; country_b_name: string; alpha2: string; recipe_count: number; mean_corr: number; best_pps: number; avg_lead_years: number | null }>> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "analogues.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const all = JSON.parse(raw) as Record<string, Record<string, Array<{
      country_b_id: number; country_b_name: string; alpha2: string;
      recipe_count: number; mean_corr: number; best_pps: number; avg_lead_years: number | null;
    }>>>;
    return all[countryId]?.[category] ?? [];
  } catch {
    return [];
  }
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

  const decodedCategory = decodeURIComponent(category);
  const analogues = await loadAnalogues(id, decodedCategory);

  return (
    <PrecedentDetailClient
      countryId={id}
      country={country}
      category={decodedCategory}
      generatedAt={data?.generated_at ?? null}
      version={data?.version ?? "unknown"}
      analogues={analogues}
    />
  );
}
