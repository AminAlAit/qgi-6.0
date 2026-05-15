import { resolveCountryBySlug } from "@/lib/country-risks";
import { loadMlRecipeBySlug, loadMlRecipeStack } from "@/lib/recipes-ml-loader";
import { SignalsV2Detail } from "@/components/signals-v2/SignalsV2Detail";
import { toBuyerView, toBuyerViewList } from "@/lib/buyer-view";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * /signals-v2b/[country]/[slug] — Lloyd's-style (country, recipe) tear-sheet.
 *
 * Identical data + structure to /signals-v2a/[country]/[slug]; caveats
 * render as full-width banners instead of footnotes.
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
  const canonical = `https://qgintelligence.com/signals-v2b/${country}/${slug}`;
  const buyer = toBuyerView(recipe);
  return {
    title: `${c.name} · ${buyer.display_name} — V2 Signal (Lloyd's) — QGI Intelligence`,
    description: `${buyer.display_name} ML recipe context for ${c.name}: ${buyer.tier} tier, out-of-country score ${buyer.loco_auc.toFixed(3)} (global). Lloyd's banner variant.`,
    alternates: { canonical },
    openGraph: {
      title: `${c.name} · ${buyer.display_name} — V2 Signal (Lloyd's)`,
      description: `${buyer.tier} tier · ${buyer.architecture_label} · out-of-country score ${buyer.loco_auc.toFixed(3)}.`,
      url: canonical,
      siteName: "QGI Intelligence",
      type: "article",
    },
  };
}

export default async function SignalsV2BSlugPage({ params }: Props) {
  const { country, slug } = await params;
  const [c, stack] = await Promise.all([
    resolveCountryBySlug(country),
    loadMlRecipeStack(),
  ]);
  if (!c) notFound();
  const raw = stack.recipes.find((r) => r.recipe_id === slug);
  if (!raw || !stack.metadata.top_4_recipes.includes(raw.recipe_id)) {
    notFound();
  }
  const buyerStack = toBuyerViewList(stack.recipes);
  const buyer = buyerStack.find((r) => r.recipe_id === slug);
  if (!buyer) notFound();
  const topRecipes = buyerStack.filter((r) =>
    stack.metadata.top_4_recipes.includes(r.recipe_id)
  );
  const paperHref = `https://github.com/AminAlAit/qgi-docs/blob/main/methodology/stage-5-buyer-disclosure-methodology-paper.md#${buyer.paper_section_anchor}`;
  return (
    <SignalsV2Detail
      recipe={buyer}
      country={c.name}
      countryAlpha2={c.alpha_2}
      countrySlugStr={country}
      topRecipes={topRecipes}
      caveatStyle="lloyds"
      generatedAt={stack.metadata.generated_at}
      paperHref={paperHref}
    />
  );
}
