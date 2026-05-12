/**
 * Per-pattern detail — /discover-patterns-b/[slug]
 *
 * Elif Şahin-Moreau style: high data density, tight typography,
 * minimum chrome. The data dossier is the UI.
 *
 * Data parity with Yuki's A-variant detail (for future merge feasibility):
 * - Same fields rendered (PPS, correlation, lead time, architecture,
 *   tier, RCI, sparkline, mechanism narrative, disclosure metrics)
 * - Different chrome: no section cards with colored headers; instead,
 *   Tufte-style inline annotation, tight gutters, rule lines.
 *
 * MOCK: data loaded from patterns-facets-mock.json. Real integration in #648.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { PatternFacet } from "../types";
import { PatternDetailClient } from "./PatternDetailClient";

interface Props {
  params: Promise<{ slug: string }>;
}

async function loadPattern(slug: string): Promise<PatternFacet | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "data", "patterns-facets-mock.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(raw) as { patterns: PatternFacet[] };
    return json.patterns.find((p) => p.slug === slug) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await loadPattern(slug);
  if (!p) return { title: "Pattern not found — QGI Intelligence" };
  return {
    title: `${p.display_name} — Patterns V2 — QGI Intelligence`,
    robots: { index: false, follow: false },
  };
}

export const revalidate = 3600;

export default async function PatternDetailPage({ params }: Props) {
  const { slug } = await params;
  const pattern = await loadPattern(slug);

  if (!pattern) notFound();

  return <PatternDetailClient pattern={pattern} />;
}
