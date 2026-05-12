import { loadMlRecipeBySlug, loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { PrecedentsV2Detail } from "@/components/precedents-v2/PrecedentsV2Detail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * /precedents-v2-b/[slug] — Lloyd's-style variant of a V2 ML recipe tear-sheet.
 *
 * Identical data + structure to /precedents-v2-a/[slug]; caveats render as
 * full-width banners instead of footnotes.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await loadMlRecipeBySlug(slug);
  if (!recipe) {
    return {
      title: "Page not found — QGI Intelligence",
      robots: { index: false, follow: false },
    };
  }
  const canonical = `https://qgintelligence.com/precedents-v2-b/${slug}`;
  return {
    title: `${recipe.display_name} — V2 Recipe (Lloyd's) — QGI Intelligence`,
    description: `${recipe.display_name}: ${recipe.tier} tier, out-of-country score ${recipe.loco_auc.toFixed(3)} (${recipe.n_pos_loco} held-out positive${recipe.n_pos_loco === 1 ? "" : "s"}). Buyer-disclosure tear-sheet with Lloyd's banner caveats.`,
    alternates: { canonical },
    openGraph: {
      title: `${recipe.display_name} — V2 Recipe (Lloyd's)`,
      description: `${recipe.tier} tier · ${recipe.architecture} architecture · out-of-country score ${recipe.loco_auc.toFixed(3)}.`,
      url: canonical,
      siteName: "QGI Intelligence",
      type: "article",
    },
  };
}

export default async function PrecedentsV2BSlugPage({ params }: Props) {
  const { slug } = await params;
  const stack = await loadMlRecipeStack();
  const recipe = stack.recipes.find((r) => r.recipe_id === slug);
  if (!recipe || !stack.metadata.top_4_recipes.includes(recipe.recipe_id)) {
    notFound();
  }
  const paperHref = `https://github.com/AminAlAit/qgi-docs/blob/main/methodology/stage-5-buyer-disclosure-methodology-paper.md#${recipe.paper_section_anchor}`;
  return (
    <PrecedentsV2Detail
      recipe={recipe}
      caveatStyle="lloyds"
      generatedAt={stack.metadata.generated_at}
      paperHref={paperHref}
    />
  );
}

export async function generateStaticParams() {
  const stack = await loadMlRecipeStack();
  return stack.metadata.top_4_recipes.map((slug) => ({ slug }));
}
