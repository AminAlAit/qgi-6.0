/**
 * country-families — derive a country's distinct lit L1 families, ordered
 * by the best (highest) recipe score in each family. Shared by the atlas
 * card, the country-page header, and the panels so "dominant family" means
 * the same thing everywhere.
 */
import { familyColor } from "@/lib/te-mock/l1-families";
import type { CountryV4 } from "@/lib/te-mock/countries-v4-data";

export interface FamilyRank {
  id: string;
  label: string;
  color: string;
  /** Best recipe score within this family for the country. */
  best: number;
}

export function familiesByBestScore(country: CountryV4): FamilyRank[] {
  const map = new Map<string, FamilyRank>();
  for (const r of country.top_recipes) {
    const cur = map.get(r.l1_id);
    if (!cur || r.score > cur.best) {
      map.set(r.l1_id, {
        id: r.l1_id,
        label: r.l1_label,
        color: familyColor(r.l1_id, r.l1_color),
        best: r.score,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.best - a.best);
}

/** Honest, user-facing label + tone for a recipe's validation status.
 *  Per Kwame's blessed relabels (2026-05-28): plain language that preserves
 *  the verdict direction, never internal machinery. `tone` drives chip color
 *  at the call site ("ok" green is reserved for the deployed state only). */
export type StatusTone = "deployed" | "neutral" | "failed";

export function statusLabel(status: string): { label: string; tone: StatusTone } {
  switch (status) {
    case "graduated":
      return { label: "Deployed", tone: "deployed" };
    case "walked_no_graduation":
      return { label: "Tested, did not hold up", tone: "failed" };
    case "in_progress":
      return { label: "In review", tone: "neutral" };
    case "live_legacy":
      return { label: "Early method, under review", tone: "neutral" };
    case "queued":
      return { label: "Not yet tested", tone: "neutral" };
    default:
      return { label: "Reported", tone: "neutral" };
  }
}
