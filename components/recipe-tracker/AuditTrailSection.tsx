"use client";

/**
 * AuditTrailSection — collapses the methodology-audit panels behind a
 * "Methodology audit trail" disclosure button. Collapsed by default.
 *
 * V4.1 §0: audit-curious users click in; default visitor sees the
 * confident catalog leaderboard.
 *
 * Contains:
 *   WalkTimeline  — recipe progression timeline
 *   InFlightPanel — recipes under validation and scheduled
 *   VacateLog     — corrections log
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { WalkTimeline } from "@/components/recipe-tracker/WalkTimeline";
import { InFlightPanel } from "@/components/recipe-tracker/InFlightPanel";
import { VacateLog } from "@/components/recipe-tracker/VacateLog";
import type { TrackerRecipe } from "@/lib/te-mock/recipes";
import type {
  WalkEvent,
  InFlightItem,
  QueuedItem,
  VacateEvent,
} from "@/lib/te-mock/recipe-tracker-extra";

interface Props {
  walks: WalkEvent[];
  inFlight: InFlightItem[];
  queued: QueuedItem[];
  vacateLog: VacateEvent[];
  recipes: TrackerRecipe[];
}

const ACCENT = "#5B7E99";

export function AuditTrailSection({
  walks,
  inFlight,
  queued,
  vacateLog,
  recipes,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section data-tour="audit-trail" style={{ marginTop: "40px" }}>
      {/* Disclosure toggle */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 16px",
          width: "100%",
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderLeft: `3px solid ${ACCENT}`,
          borderRadius: "6px",
          cursor: "pointer",
          color: "var(--qgi-text)",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <ClipboardList size={16} color={ACCENT} aria-hidden="true" />
        <span
          style={{
            flex: 1,
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--qgi-text)",
          }}
        >
          Methodology audit trail
        </span>
        <span
          style={{
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            marginRight: "8px",
          }}
        >
          {open ? "hide" : "show"} — recipe progression, in-progress, corrections
        </span>
        {open ? (
          <ChevronDown size={16} color="var(--qgi-text-dim)" aria-hidden="true" />
        ) : (
          <ChevronRight size={16} color="var(--qgi-text-dim)" aria-hidden="true" />
        )}
      </button>

      {/* Expanded content */}
      {open && (
        <div
          style={{
            marginTop: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* Recipe progression timeline */}
          <WalkTimeline walks={walks} recipes={recipes} />

          {/* Side panels: in-progress + corrections */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "20px",
            }}
          >
            <InFlightPanel inFlight={inFlight} queued={queued} recipes={recipes} />
            <VacateLog events={vacateLog} />
          </div>
        </div>
      )}
    </section>
  );
}
