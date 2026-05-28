/**
 * /recipes/[slug]/trajectory — the per-recipe "Trajectory" deep-dive.
 *
 * The canonical movement shape of a recipe, given its own page under the
 * recipe (was /patterns/[id]; migrated here so "pattern" returns to its
 * SCDI/Cascade meaning at /patterns). Built to the V4.1 bar via
 * TrajectoryDetail. Only recipes that ship a curated shape resolve; others
 * 404 (and the recipe page only links here when a trajectory exists).
 *
 * Server component; params is Promise per Next.js 16. Mockup only, local-only.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPatterns, getPattern } from "@/lib/te-mock/patterns-v4-data";
import { getRecipe } from "@/lib/te-mock/recipes";
import { TrajectoryDetail } from "@/components/precedents-v4-1/TrajectoryDetail";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPatterns().map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pattern = getPattern(slug);
  return {
    title: pattern
      ? `${pattern.name} trajectory (v4.1 mockup) · QG Intelligence`
      : "Trajectory not found · QG Intelligence",
    description: pattern
      ? `The canonical movement shape of ${pattern.name}: a ${pattern.window_y}-year run-up across ${pattern.n_positives || "the available"} verified cases. Local-only mockup.`
      : "Trajectory not found.",
    robots: { index: false, follow: false },
  };
}

export default async function TrajectoryDeepDivePage({ params }: PageProps) {
  const { slug } = await params;
  const pattern = getPattern(slug);
  if (!pattern) notFound();
  const recipe = getRecipe(pattern.recipe_id);
  if (!recipe) notFound();
  return <TrajectoryDetail pattern={pattern} recipe={recipe} />;
}
