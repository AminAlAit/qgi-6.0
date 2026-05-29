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

/** User-facing label + tone for a recipe's validation status.
 *
 *  V4.1 vocabulary (`qgi-docs/internal/ops/qgi-v4-1-ux-rules.md` §4):
 *  - validated / LOCK     → "Validated"    (green; the green chip only)
 *  - directional / experimental / walked-no-grad → "In play"   (calm blue)
 *  - queued / hold        → "Coming soon"  (slate-dim)
 *  - live_legacy          → "Prior version" (slate-dim)
 *
 *  Replaces "Tested, did not hold up", "Walked, not graduated",
 *  "Reviewed, not graduated", "Early method, under review", and every
 *  other "we tried, it didn't graduate" phrasing. The audience reads
 *  "In play" as "we are actively using and refining this" — which is true.
 */
export type StatusTone = "deployed" | "neutral" | "failed";

export function statusLabel(status: string): { label: string; tone: StatusTone } {
  switch (status) {
    case "graduated":
      return { label: "Validated", tone: "deployed" };
    case "walked_no_graduation":
      return { label: "In play", tone: "neutral" };
    case "in_progress":
      return { label: "In play", tone: "neutral" };
    case "live_legacy":
      return { label: "Prior version", tone: "neutral" };
    case "queued":
      return { label: "Coming soon", tone: "neutral" };
    default:
      return { label: "Coming soon", tone: "neutral" };
  }
}
