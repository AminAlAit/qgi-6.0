import { loadCountryRisks } from "@/lib/country-risks";
import { PrecedentsListClient } from "@/components/precedents/PrecedentsListClient";
import type { Metadata } from "next";

// T19 #312: adds openGraph + twitter so precedents page is shareable.
export const metadata: Metadata = {
  title: "Precedents Browser — QGI Intelligence",
  description:
    "Browse all country-category precedent combinations ranked by salience score.",
  alternates: { canonical: "https://qgintelligence.com/precedents" },
  openGraph: {
    title: "Precedents Browser — QGI Intelligence",
    description:
      "Browse all country-category precedent combinations ranked by salience score.",
    url: "https://qgintelligence.com/precedents",
    siteName: "QGI Intelligence",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Precedents Browser — QGI Intelligence",
    description:
      "Browse all country-category precedent combinations ranked by salience score.",
  },
};

/**
 * Flatten every country x S-tier category into a single precedent row list,
 * then pass it to the client component for filtering / sorting / pagination.
 */
export default async function PrecedentsPage() {
  let rows: Array<{
    countryId: string;
    countryName: string;
    alpha2: string;
    curated: boolean;
    riskTier: string;
    category: string;
    salienceScore: number;
    zScore: number;
    recipeCount: number;
    lastEventYear: number | null;
  }> = [];
  let error: string | null = null;

  try {
    const data = await loadCountryRisks();

    for (const [countryId, country] of Object.entries(data.countries)) {
      const sTier = country.tiers?.S;
      if (!sTier?.top_categories?.length) continue;

      for (const cat of sTier.top_categories) {
        rows.push({
          countryId,
          countryName: country.name,
          alpha2: country.alpha_2,
          curated: country.curated,
          riskTier: country.overall_risk_tier ?? "INDICATIVE",
          category: cat.category,
          salienceScore: cat.salience_score ?? 0,
          zScore: cat.z_score ?? 0,
          recipeCount: cat.recipe_count ?? 0,
          lastEventYear: cat.last_event_year ?? null,
        });
      }
    }
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
          Precedents Browser
        </h1>
        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
          }}
        >
          <p style={{ color: "var(--qgi-text-muted)" }}>
            Precedent data not yet available. Run{" "}
            <code className="font-data text-xs">generate_country_risks.py</code>{" "}
            to generate the data.
          </p>
        </div>
      </div>
    );
  }

  return <PrecedentsListClient rows={rows} />;
}
