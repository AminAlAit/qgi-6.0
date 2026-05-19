/**
 * T1 (#59) — Pattern trajectory cell rendered on /patterns list view.
 *
 * Replaces the prior `Sparkline` + "Trajectory pending" chip placeholder.
 * Two stacked lines per row (~38px total):
 *
 *   Line 1 (narrative): "{LeaderCountry} window closed {year} · {Event title}"
 *   Line 2 (position):  "[████░░░░] Year {n} of {N}"
 *
 * Design synthesis of Ingrid (Cairo / narrative) + Elif (Tufte / inline-
 * density) Majles consults, 2026-05-19. Position bar styling = Elif's
 * minimum-mark recommendation (single accent tick on a neutral track).
 * Narrative copy template = Ingrid's "Cairo principle: answer the question
 * the reader is already forming."
 *
 * Missing-event state ("No verified event on record") is Ingrid's
 * honest framing — never says "pending" because the lookup has resolved
 * (negatively).
 *
 * Phase C (editorial polish) is enabled via the `dataEditorial` flag on
 * the trajectory's terminatingEvent; when true, this cell will render
 * a 4px left accent border to mark editorial provenance. The data flow
 * for that is reserved here; no Phase C entries exist in the corpus yet.
 */
import type { PatternTrajectory } from "@/lib/pattern-trajectory";

interface Props {
  trajectory: PatternTrajectory;
  leaderCountry: string;
}

/** Trim long verified-event titles to a scannable length (Ingrid: ≤10 words). */
function truncateTitle(title: string, maxChars = 56): string {
  if (title.length <= maxChars) return title;
  return `${title.slice(0, maxChars - 1).trimEnd()}…`;
}

export function PatternTrajectoryCell({ trajectory, leaderCountry }: Props) {
  const { terminatingEvent, leaderEndYear, followerYearsElapsed, patternLength } =
    trajectory;
  const progressPct = patternLength > 0 ? followerYearsElapsed / patternLength : 0;
  const isEditorial = terminatingEvent?.dataEditorial ?? false;

  const narrativeLine = terminatingEvent
    ? `${leaderCountry} window closed ${terminatingEvent.year} · ${truncateTitle(terminatingEvent.title)}`
    : `${leaderCountry} window closes ~${leaderEndYear} · No verified event on record`;

  const positionLabel = `Year ${followerYearsElapsed} of ${patternLength}`;

  return (
    <div
      className="flex flex-col gap-1 min-w-0"
      style={
        isEditorial
          ? { borderLeft: "4px solid var(--qgi-accent)", paddingLeft: 6 }
          : undefined
      }
      data-event-id={terminatingEvent?.source ?? ""}
      data-editorial={isEditorial ? "true" : "false"}
    >
      <div
        className="text-[11px] leading-tight truncate"
        style={{
          color: terminatingEvent ? "var(--qgi-text)" : "var(--qgi-text-dim)",
          fontStyle: terminatingEvent ? "normal" : "italic",
        }}
        title={
          terminatingEvent
            ? `${terminatingEvent.title} — ${terminatingEvent.country}, ${terminatingEvent.year}. Source: ${terminatingEvent.source}`
            : `No event found in verified-events.json for ${leaderCountry} within ±2 years of ${leaderEndYear}.`
        }
      >
        {narrativeLine}
      </div>
      <div
        className="flex items-center gap-1.5"
        aria-label={positionLabel}
        title={`Follower is ${followerYearsElapsed} years into a ${patternLength}-year pattern.`}
      >
        <div
          role="presentation"
          className="relative h-[3px] flex-1 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--qgi-surface-2)" }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${Math.round(progressPct * 100)}%`,
              backgroundColor: "var(--qgi-accent)",
            }}
          />
        </div>
        <span
          className="text-[9px] tracking-wider font-data tabular-nums whitespace-nowrap"
          style={{ color: "var(--qgi-text-muted)" }}
        >
          {positionLabel}
        </span>
      </div>
    </div>
  );
}
