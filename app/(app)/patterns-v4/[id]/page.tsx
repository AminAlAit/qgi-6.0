/**
 * /patterns-v4/[id] — per-pattern detail page (V4 mockup).
 *
 * Renders one canonical movement shape: definition, indicators, historical
 * examples, present-tense top matches, plain-English reading guide, and the
 * M8-R5 anti-causal firewall.
 *
 * Next.js 16: `params` is a Promise per
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`.
 * Server Component by default — no `"use client"` here. The interactive
 * ranking client is only on /patterns-v4/ranking.
 *
 * Pre-renders all known patterns via `generateStaticParams()`.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPatterns, getPattern } from "@/lib/te-mock/patterns-v4-data";
import { getRecipe } from "@/lib/te-mock/recipes";
import { PatternDetail } from "@/components/patterns-v4/PatternDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return getAllPatterns().map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const pattern = getPattern(id);
  return {
    title: pattern
      ? `${pattern.name} pattern (v4 mockup) · QG Intelligence`
      : "Pattern not found · QG Intelligence",
    description: pattern
      ? `Canonical movement shape for ${pattern.name}: ${pattern.window_y}-year window across ${pattern.n_positives || "the available"} verified positives. Local mockup only.`
      : "Pattern detail mockup — local only, not for production.",
    robots: { index: false, follow: false },
  };
}

export default async function PatternDetailPage({ params }: PageProps) {
  const { id } = await params;
  const pattern = getPattern(id);
  if (!pattern) notFound();
  const recipe = getRecipe(pattern.recipe_id);
  if (!recipe) notFound();
  return <PatternDetail pattern={pattern} recipe={recipe} />;
}
