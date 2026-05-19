/**
 * T1 (#59) — Pattern trajectory enrichment.
 *
 * For each pattern pair on /patterns, compute:
 *   - the LEADER's terminating event (real-world event from
 *     verified-events.json closest to end_year_a)
 *   - the FOLLOWER's current position within its projected arc
 *
 * The "terminating event" is the 4th of the 5 recipe components per the
 * QGI methodology North Star (`qgi-docs/internal/methodology-north-star.md`):
 *   "what the recipe leads to (the precedent's outcome)."
 *
 * R7 personas (all 5 independently) asked for this on /patterns. EIC's
 * estimate: shipping this moves 2 of 5 R7 stories from B-grade to A-grade.
 *
 * This is Phase B (algorithmic) of the founder-ratified B-then-C plan:
 *   B = derive from verified-events.json (this file)
 *   C = layer hand-authored editorial polish per pair (future, opt-in via
 *       the `data_editorial` flag reserved on TerminatingEvent)
 */
import type { PatternRow } from "@/lib/types";

/** Raw record shape in `data/verified-events.json`. */
export interface VerifiedEvent {
  country: string;
  year: number;
  title: string;
  category: string;
  source: string;
  sourceDomain?: string;
}

export interface TerminatingEvent {
  country: string;
  year: number;
  title: string;
  category: string;
  source: string;
  /** Reserved for Phase C — hand-authored gloss overrides `title`. */
  editorialTitle?: string;
  /** True when sourced from `qgi-data` editorial overrides instead of the
   *  algorithmic verified-events.json lookup. Default false (Phase B). */
  dataEditorial: boolean;
}

export interface PatternTrajectory {
  /** Leader's projected window-close year (start_year_a + pattern_length). */
  leaderEndYear: number;
  /** Closest event to leaderEndYear for country_a, or null when none in tolerance. */
  terminatingEvent: TerminatingEvent | null;
  /** Follower's projected window-close year. */
  followerEndYear: number;
  /** Years elapsed in follower's arc (clamped 0..pattern_length). */
  followerYearsElapsed: number;
  /** Pattern length, surfaced for cell render convenience. */
  patternLength: number;
}

/**
 * Tolerance in years for the leader-end event lookup. Wider than ±1 to
 * accommodate slightly-off bake timing and event-corpus year granularity;
 * narrower than ±5 to avoid claiming unrelated events as "terminating."
 * Ingrid's design recommendation: ±2.
 */
export const EVENT_LOOKUP_TOLERANCE_YEARS = 2;

/**
 * Find the most relevant event for `country` near `targetYear`.
 *
 * Selection rule:
 *   1. Filter to events on this country within ±EVENT_LOOKUP_TOLERANCE_YEARS
 *   2. Among those, prefer the one with the smallest |year - targetYear|
 *   3. Ties broken by lexicographic title (deterministic; events at the
 *      same year + same country should be rare).
 *
 * Returns null when nothing in tolerance. We do NOT fabricate "soft" matches
 * from outside the tolerance — Ingrid's missing-data state ("No verified
 * event on record") is the honest answer.
 */
export function findTerminatingEvent(
  country: string,
  targetYear: number,
  events: ReadonlyArray<VerifiedEvent>
): TerminatingEvent | null {
  const lowerCountry = country.toLowerCase();
  let best: VerifiedEvent | null = null;
  let bestDistance = Infinity;
  for (const ev of events) {
    if (ev.country.toLowerCase() !== lowerCountry) continue;
    const distance = Math.abs(ev.year - targetYear);
    if (distance > EVENT_LOOKUP_TOLERANCE_YEARS) continue;
    if (
      distance < bestDistance ||
      (distance === bestDistance &&
        best !== null &&
        ev.title.localeCompare(best.title) < 0)
    ) {
      best = ev;
      bestDistance = distance;
    }
  }
  if (!best) return null;
  return {
    country: best.country,
    year: best.year,
    title: best.title,
    category: best.category,
    source: best.source,
    dataEditorial: false,
  };
}

/**
 * Compute the full trajectory for a pattern row given the events corpus
 * and a reference "current year" (parameterized for test determinism).
 *
 * Direction convention: country_a = LEADER (analogue, completed arc),
 * country_b = FOLLOWER (live case). Confirmed by Ingrid 2026-05-19.
 */
export function computePatternTrajectory(
  row: Pick<
    PatternRow,
    "country_a" | "country_b" | "start_year_a" | "start_year_b" | "pattern_length"
  >,
  events: ReadonlyArray<VerifiedEvent>,
  currentYear: number = new Date().getFullYear()
): PatternTrajectory {
  const leaderEndYear = row.start_year_a + row.pattern_length;
  const followerEndYear = row.start_year_b + row.pattern_length;
  const followerYearsElapsed = Math.max(
    0,
    Math.min(row.pattern_length, currentYear - row.start_year_b)
  );
  const terminatingEvent = findTerminatingEvent(row.country_a, leaderEndYear, events);
  return {
    leaderEndYear,
    terminatingEvent,
    followerEndYear,
    followerYearsElapsed,
    patternLength: row.pattern_length,
  };
}
