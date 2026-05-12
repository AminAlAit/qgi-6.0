import { resolveCountryBySlug } from "@/lib/country-risks";
import { loadMlRecipeBySlug, loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { SignalsV2Detail } from "@/components/signals-v2/SignalsV2Detail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * /signals-v2-a/[country]/[slug] — Tufte-style (country, recipe) tear-sheet.
 *
 * MVP-shallow (#655 founder pick 2026-05-12): page exists; recipe metrics
 * are global (not country-specific). Country slug in header + recipe-
 * switcher in breadcrumb let users navigate the 4-recipe space.
 */

interface Props {
  params: Promise<{ country: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, slug } = await params;
  const [c, recipe] = await Promise.all([
    resolveCountryBySlug(country),
    loadMlRecipeBySlug(slug),
  ]);
  if (!c || !recipe) {
    return {
      title: "Page not found — QGI Intelligence",
      robots: { index: false, follow: false },
    };
  }
  const canonical = `https://qgintelligence.com/signals-v2-a/${country}/${slug}`;
  return {
    title: `${c.name} · ${recipe.display_name} — V2 Signal (Tufte) — QGI Intelligence`,
    description: `${recipe.display_name} ML recipe context for ${c.name}: ${recipe.tier} tier, out-of-country score ${recipe.loco_auc.toFixed(3)} (global). Tufte footnote variant.`,
    alternates: { canonical },
    openGraph: {
      title: `${c.name} · ${recipe.display_name} — V2 Signal (Tufte)`,
      description: `${recipe.tier} tier · ${recipe.architecture} architecture · out-of-country score ${recipe.loco_auc.toFixed(3)}.`,
      url: canonical,
      siteName: "QGI Intelligence",
      type: "article",
    },
  };
}

export default async function SignalsV2ASlugPage({ params }: Props) {
  const { country, slug } = await params;
  const [c, stack] = await Promise.all([
    resolveCountryBySlug(country),
    loadMlRecipeStack(),
  ]);
  if (!c) notFound();
  const recipe = stack.recipes.find((r) => r.recipe_id === slug);
  if (!recipe || !stack.metadata.top_4_recipes.includes(recipe.recipe_id)) {
    notFound();
  }
  const topRecipes = stack.recipes.filter((r) =>
    stack.metadata.top_4_recipes.includes(r.recipe_id)
  );
  const paperHref = `https://github.com/AminAlAit/qgi-docs/blob/main/methodology/stage-5-buyer-disclosure-methodology-paper.md#${recipe.paper_section_anchor}`;
  const slugMap: Record<string, string> = Object.fromEntries(
    stack.recipes.map((r) => [r.recipe_id, r.display_name])
  );
  return (
    <SignalsV2Detail
      recipe={recipe}
      country={c.name}
      countryAlpha2={c.alpha_2}
      countrySlugStr={country}
      topRecipes={topRecipes}
      caveatStyle="tufte"
      generatedAt={stack.metadata.generated_at}
      paperHref={paperHref}
      slugMap={slugMap}
    />
  );
}
