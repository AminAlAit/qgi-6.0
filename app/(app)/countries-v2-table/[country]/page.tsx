/**
 * /countries-v2-table/[country] — Dense per-country dossier
 *
 * Design: Elif Şahin-Moreau + Rodrigo Vasconcelos-Kwok
 * Terminal-grade. Power-user assumption.
 *
 * Shows:
 *   - Risk tier breakdown by S/M/L/XL bucket (top_categories per tier)
 *   - ML coverage matrix (which of 13 LOCKed recipes apply; MOCK AHI)
 *   - Per-L1 percentile micro-bars (Tufte small-multiples)
 *   - Recent events list (MOCK)
 *   - Indicator panel (MOCK)
 *
 * Params: `country` = countrySlug(name) or numeric id (same resolver as V1)
 */
import { notFound } from "next/navigation";
import { loadCountryRisks } from "@/lib/country-risks";
import { countrySlug } from "@/lib/slug";
import { loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { CountryDossierClient } from "@/components/countries-v2-table/CountryDossierClient";
import type { Metadata } from "next";
import type { CountryRisk } from "@/lib/country-risks";
import type { MlRecipeStack } from "@/lib/recipes-ml";

export const revalidate = 3600;

interface Props {
  params: Promise<{ country: string }>;
}

async function resolveCountry(
  slug: string
): Promise<{ id: string; data: CountryRisk } | null> {
  const risks = await loadCountryRisks().catch(() => null);
  if (!risks) return null;
  const needle = slug.toLowerCase().replace(/-/g, "_");
  // Numeric id fast path
  if (/^\d+$/.test(needle)) {
    const d = risks.countries[needle];
    if (d) return { id: needle, data: d };
  }
  // alpha_2 match
  for (const [id, c] of Object.entries(risks.countries)) {
    if (c.alpha_2?.toLowerCase() === needle) return { id, data: c };
  }
  // Slug match
  for (const [id, c] of Object.entries(risks.countries)) {
    if (countrySlug(c.name) === needle) return { id, data: c };
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country: slug } = await params;
  const resolved = await resolveCountry(slug);
  if (!resolved) {
    return {
      title: "Country not found — QGI Intelligence",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `${resolved.data.name} — Analyst Dossier — QGI Intelligence`,
    description: `Dense risk dossier for ${resolved.data.name}: tier breakdown, ML recipe coverage, event activity, and indicator panel.`,
    robots: { index: false, follow: false },
  };
}

export default async function CountryDossierPage({ params }: Props) {
  const { country: slug } = await params;
  const resolved = await resolveCountry(slug);
  if (!resolved) notFound();

  let stack: MlRecipeStack | null = null;
  try {
    stack = await loadMlRecipeStack();
  } catch {
    // ML stack optional — renders without it
  }

  return (
    <CountryDossierClient
      countryId={resolved.id}
      countryData={resolved.data}
      mlStack={stack}
    />
  );
}
