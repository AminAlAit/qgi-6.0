import {
  loadRecipeBySlug,
  loadCountryRecipeScores,
} from "@/lib/recipes-aggregated-loader";
import { loadCountryRisks } from "@/lib/country-risks";
import { PrecedentSlugClient } from "@/components/precedents-v1/PrecedentSlugClient";
import { CATEGORY_L1_MAP } from "@/lib/category-taxonomy";
import { countrySlug } from "@/lib/slug";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Validate against the canonical L3 taxonomy first — even if the
  // mock JSON happens to have the slug, an unknown slug shouldn't end
  // up in the title (#452 same shape of bug).
  if (!(slug in CATEGORY_L1_MAP)) {
    return {
      title: "Page not found · QG Intelligence",
      robots: { index: false, follow: false },
    };
  }
  const recipe = await loadRecipeBySlug(slug);
  const label = formatCategory(slug);
  const description = recipe
    ? `Historical recipe for ${label}: ${recipe.total_instances} instances, canonical pattern length ${recipe.canonical_length} years. Indicator fingerprint, length distribution, and currently-flagged countries.`
    : `Historical recipe for ${label}.`;
  const canonical = `https://qgintelligence.com/precedents-v1/${slug}`;
  return {
    title: `${label} · Recipe · QG Intelligence`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${label} · Recipe`,
      description,
      url: canonical,
      siteName: "QG Intelligence",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${label} · Recipe`,
      description,
    },
  };
}

export default async function PrecedentSlugPage({ params }: Props) {
  const { slug } = await params;
  if (!(slug in CATEGORY_L1_MAP)) notFound();

  const recipe = await loadRecipeBySlug(slug);
  if (!recipe) notFound();

  // Cross-reference: which countries currently have this signal firing?
  // Read country-recipe-scores-mock + country-risks for display metadata
  // (name + alpha_2 for the flag).
  const scoresFile = await loadCountryRecipeScores().catch(() => null);
  const risksFile = await loadCountryRisks().catch(() => null);

  // country slug → numeric id (for /signals/{country-slug}/{slug} link
  // — uses slug, not numeric, but we need the country name from risks)
  const slugToCountry = new Map<
    string,
    { id: string; name: string; alpha_2: string; tier: string }
  >();
  if (risksFile) {
    for (const [id, c] of Object.entries(risksFile.countries)) {
      const s = countrySlug(c.name);
      if (!s) continue;
      slugToCountry.set(s, {
        id,
        name: c.name,
        alpha_2: c.alpha_2,
        tier: c.overall_risk_tier,
      });
    }
  }

  const flaggedCountries: Array<{
    countrySlug: string;
    name: string;
    alpha_2: string;
    score: number;
    tier: string;
  }> = [];
  if (scoresFile) {
    for (const [cSlug, byRecipe] of Object.entries(scoresFile.scores)) {
      const score = byRecipe[slug];
      if (typeof score !== "number") continue;
      const meta = slugToCountry.get(cSlug);
      flaggedCountries.push({
        countrySlug: cSlug,
        // Fall back to a humanised slug if the country isn't in the
        // V1.9.1 risks dataset (mock often has more countries than the
        // baked file does — that's fine, we still want the link).
        name: meta?.name ?? formatCategory(cSlug),
        alpha_2: meta?.alpha_2 ?? "",
        score,
        tier: meta?.tier ?? "INDICATIVE",
      });
    }
    flaggedCountries.sort((a, b) => b.score - a.score);
  }

  return <PrecedentSlugClient recipe={recipe} flaggedCountries={flaggedCountries} />;
}
