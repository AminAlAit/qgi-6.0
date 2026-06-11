/**
 * hf/trend-signal — the news layer seen from a TREND's side.
 *
 * A trend's news signal rides its primary incoming theme (the news Topic
 * whose high-confidence crosswalk feeds this trend). For every covered
 * country we pair THIS trend's structural score (fleet run-2, 0-100) with
 * the theme's monthly news pulse and read the same 60/60 verdict the rest
 * of the news layer uses. Server-side only; pages slice and pass props.
 */

import { getHfBoard, type HfTopic, type HfVerdict } from "@/lib/hf/topics-data";
import { getRecipeFullScoreMap } from "@/lib/te-mock/risk-board-data";
import { iso2For } from "@/lib/te-mock/country-flags";

export interface TrendSignalRow {
  name: string;
  iso3: string;
  /** ISO-2 (lowercase) — keys the /trends/[slug]/countries/[iso] page. */
  iso2: string | null;
  /** This trend's structural score for the country, 0-100. */
  struct: number;
  /** The primary theme's news pulse for the country, 0-100. */
  pulse: number;
  verdict: HfVerdict;
}

export interface TrendNewsSignal {
  topic: HfTopic;
  rows: TrendSignalRow[];
  /** Covered countries missing from this trend's fleet scoring (indicator
   *  coverage gaps) — named in the panel footnote rather than silently
   *  dropped (review finding: Myanmar vanished from currency_crisis). */
  notScored: string[];
  thresholds: { struct: number; pulse: number };
  verdicts: Record<HfVerdict, string>;
}

function verdictAt(
  struct: number,
  pulse: number,
  th: { struct: number; pulse: number }
): HfVerdict {
  const hiS = struct >= th.struct;
  const hiP = pulse >= th.pulse;
  if (hiS && hiP) return "ACTIVE";
  if (!hiS && hiP) return "SIGNAL";
  if (hiS && !hiP) return "LATENT";
  return "QUIET";
}

/**
 * The trend's primary theme: a board theme listing this trend in its
 * high-confidence crosswalk, validated themes first; remaining ties break
 * on the CANONICAL T01..T14 taxonomy order (deliberate, not accidental:
 * e.g. political_violence sits in both Armed Conflict (T02) and Terrorism
 * (T03) — T02 wins, matching the PoC's ratified live mapping). Null when
 * no theme feeds the trend (news-blind or low-confidence only) — callers
 * hide the panel rather than render an empty frame.
 */
export function primaryThemeFor(recipeId: string): HfTopic | null {
  const board = getHfBoard();
  const orderOf = (t: HfTopic) => board.topics.indexOf(t);
  const candidates = board.topics.filter((t) => t.trends.includes(recipeId));
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) =>
      Number(b.board) - Number(a.board) ||
      Number(b.validated) - Number(a.validated) ||
      orderOf(a) - orderOf(b)
  );
  return candidates[0];
}

export function getTrendNewsSignal(recipeId: string): TrendNewsSignal | null {
  const topic = primaryThemeFor(recipeId);
  if (!topic) return null;
  const board = getHfBoard();

  const scores = getRecipeFullScoreMap(recipeId);
  if (!scores || Object.keys(scores).length === 0) return null;
  // Fleet scores are 0-100; normalize defensively if a future file is 0-1.
  const maxScore = Math.max(...Object.values(scores));
  const scale = maxScore <= 1.5 ? 100 : 1;

  const rows: TrendSignalRow[] = [];
  const notScored: string[] = [];
  for (const c of board.countries) {
    const raw = scores[c.name];
    const cell = board.cells[`${c.iso3}|${topic.id}`];
    if (!cell) continue;
    if (typeof raw !== "number") {
      // Covered by the news layer but not scored on this trend — name it
      // rather than silently dropping it.
      notScored.push(c.name);
      continue;
    }
    const struct = Math.round(raw * scale * 10) / 10;
    rows.push({
      name: c.name,
      iso3: c.iso3,
      iso2: iso2For(c.name) ?? null,
      struct,
      pulse: cell.pulse,
      verdict: verdictAt(struct, cell.pulse, board.thresholds),
    });
  }
  if (rows.length === 0) return null;

  // Strongest combined reading first (weakest-leg rule, as everywhere).
  rows.sort((a, b) => Math.min(b.struct, b.pulse) - Math.min(a.struct, a.pulse));

  return {
    topic,
    rows,
    notScored,
    thresholds: board.thresholds,
    verdicts: board.verdicts,
  };
}
