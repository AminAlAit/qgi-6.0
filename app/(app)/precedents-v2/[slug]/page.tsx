import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllRecipes, getRecipe } from "@/lib/te-mock/recipes";
import { RecipeDetail } from "@/components/precedents-v2/RecipeDetail";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllRecipes().map((r) => ({ slug: r.recipe_id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const recipe = getRecipe(slug);
  return {
    title: recipe
      ? `${recipe.label} (mockup) · QG Intelligence`
      : "Recipe not found · QG Intelligence",
    description: "Recipe detail mockup — local only, not for production.",
    robots: { index: false, follow: false },
  };
}

export default async function RecipeDetailPage({ params }: Params) {
  const { slug } = await params;
  const recipe = getRecipe(slug);
  if (!recipe) notFound();
  return <RecipeDetail recipe={recipe} />;
}
