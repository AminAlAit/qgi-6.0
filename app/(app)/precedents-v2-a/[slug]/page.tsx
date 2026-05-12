import { loadMlRecipeBySlug, loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { PrecedentsV2Detail } from "@/components/precedents-v2/PrecedentsV2Detail";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * /precedents-v2-a/[slug] — Tufte-style variant of a V2 ML recipe tear-sheet.
 *
 * Per resurfacing plan Q21 + #656 DECISION: render the per-recipe disclosure
 * stack with footnote-style caveats. Sister at /precedents-v2-b/[slug]
 * renders the same data with banner caveats.
 *
 * notFound() for any slug not in the top-4 ship list (currently 4 routes
 * are statically reachable). Vercel will 404 for unknown slugs.
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
  const canonical = `https://qgintelligence.com/precedents-v2-a/${slug}`;
  return {
    title: `${recipe.display_name} — V2 Recipe (Tufte) — QGI Intelligence`,
    description: `${recipe.display_name}: ${recipe.tier} tier, out-of-country score ${recipe.loco_auc.toFixed(3)} (${recipe.n_pos_loco} held-out positive${recipe.n_pos_loco === 1 ? "" : "s"}). Buyer-disclosure tear-sheet with Tufte footnote caveats.`,
    alternates: { canonical },
    openGraph: {
      title: `${recipe.display_name} — V2 Recipe (Tufte)`,
      description: `${recipe.tier} tier · ${recipe.architecture} architecture · out-of-country score ${recipe.loco_auc.toFixed(3)}.`,
      url: canonical,
      siteName: "QGI Intelligence",
      type: "article",
    },
  };
}

export default async function PrecedentsV2ASlugPage({ params }: Props) {
  const { slug } = await params;
  const stack = await loadMlRecipeStack();
  const recipe = stack.recipes.find((r) => r.recipe_id === slug);
  if (!recipe || !stack.metadata.top_4_recipes.includes(recipe.recipe_id)) {
    notFound();
  }
  const paperHref = `https://github.com/AminAlAit/qgi-docs/blob/main/methodology/stage-5-buyer-disclosure-methodology-paper.md#${recipe.paper_section_anchor}`;
  // Full slug → display-name map so cross-recipe slug references in prose
  // (e.g. mechanism narrative mentioning "elections_and_voting" while
  // rendering civil_war page) get rewritten too.
  const slugMap: Record<string, string> = Object.fromEntries(
    stack.recipes.map((r) => [r.recipe_id, r.display_name])
  );
  return (
    <PrecedentsV2Detail
      recipe={recipe}
      caveatStyle="tufte"
      generatedAt={stack.metadata.generated_at}
      paperHref={paperHref}
      slugMap={slugMap}
    />
  );
}

// Pre-generate the top-4 slugs at build time
export async function generateStaticParams() {
  const stack = await loadMlRecipeStack();
  return stack.metadata.top_4_recipes.map((slug) => ({ slug }));
}
