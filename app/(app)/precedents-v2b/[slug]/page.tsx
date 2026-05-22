import { loadMlRecipeBySlug, loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { PrecedentsV2Detail } from "@/components/precedents-v2/PrecedentsV2Detail";
import { buildSlugMap, toBuyerView } from "@/lib/buyer-view";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * /precedents-v2b/[slug] — Lloyd's-style variant of a V2 ML recipe tear-sheet.
 *
 * Identical data + structure to /precedents-v2a/[slug]; caveats render as
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
      title: "Page not found · QGI Intelligence",
      robots: { index: false, follow: false },
    };
  }
  const canonical = `https://qgintelligence.com/precedents-v2b/${slug}`;
  const buyer = toBuyerView(recipe);
  return {
    title: `${buyer.display_name} · V2 Recipe (Lloyd's) · QGI Intelligence`,
    description: `${buyer.display_name}: ${buyer.tier} tier, out-of-country score ${buyer.loco_auc.toFixed(3)} (${buyer.n_pos_loco} held-out positive${buyer.n_pos_loco === 1 ? "" : "s"}). Buyer-disclosure tear-sheet with Lloyd's banner caveats.`,
    alternates: { canonical },
    openGraph: {
      title: `${buyer.display_name} · V2 Recipe (Lloyd's)`,
      description: `${buyer.tier} tier · ${buyer.architecture_label} · out-of-country score ${buyer.loco_auc.toFixed(3)}.`,
      url: canonical,
      siteName: "QGI Intelligence",
      type: "article",
    },
  };
}

export default async function PrecedentsV2BSlugPage({ params }: Props) {
  const { slug } = await params;
  const stack = await loadMlRecipeStack();
  const raw = stack.recipes.find((r) => r.recipe_id === slug);
  if (!raw || !stack.metadata.top_4_recipes.includes(raw.recipe_id)) {
    notFound();
  }
  const slugMap = buildSlugMap(stack.recipes);
  const buyer = toBuyerView(raw, slugMap);
  const paperHref = `https://github.com/AminAlAit/qgi-docs/blob/main/methodology/stage-5-buyer-disclosure-methodology-paper.md#${buyer.paper_section_anchor}`;
  return (
    <PrecedentsV2Detail
      recipe={buyer}
      caveatStyle="lloyds"
      generatedAt={stack.metadata.generated_at}
      paperHref={paperHref}
      backHref="/precedents-v2b"
      backLabel="← Back to V2 precedents list (Lloyd's)"
    />
  );
}

export async function generateStaticParams() {
  const stack = await loadMlRecipeStack();
  return stack.metadata.top_4_recipes.map((slug) => ({ slug }));
}
