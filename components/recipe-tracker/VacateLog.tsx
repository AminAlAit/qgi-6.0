import Link from "next/link";
import type { Route } from "next";
import { ArchiveX } from "lucide-react";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";
import type { VacateEvent } from "@/lib/te-mock/recipe-tracker-extra";

/** Sanitize data-layer note text: replace internal acronyms with plain
 *  language before rendering. The data file is read-only shared utility. */
function sanitizeNote(note: string): string {
  return (
    note
      .replace(/F-ML-\d+/gi, "ML pre-registration")
      .replace(/F-ML-N/gi, "future ML pre-registration")
      .replace(/LOCO-AUC/g, "out-of-sample discrimination score")
      .replace(/\bLOCO\b/g, "out-of-sample discrimination")
      .replace(/\bvacated\b/gi, "withdrawn")
      .replace(/\bvacate\b/gi, "correction")
      .replace(/re-walk/gi, "re-validation")
      // \bwalk\b sits after re-walk so the longer pattern grabs first
      // (parity with components/recipe-tracker/InFlightPanel.tsx:sanitizeNote).
      .replace(/\bwalk\b/gi, "validation pass")
      .replace(/\bin flight\b/gi, "in review")
      .replace(/\bfan-out\b/gi, "production rollout")
      .replace(/\btruncation\b/gi, "coverage gap")
  );
}

/** Plain-language label for a prior_status value shown in the correction
 *  header line (e.g. "graduated" → "Deployed"). */
function priorStatusLabel(status: string): string {
  switch (status) {
    case "graduated":
      return "DEPLOYED";
    case "directional":
      return "DIRECTIONAL";
    default:
      return status.toUpperCase();
  }
}

export function VacateLog({ events }: { events: VacateEvent[] }) {
  return (
    <section
      data-tour="vacate-log"
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderLeft: "3px solid #E64545",
        borderRadius: "6px",
        padding: "16px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "10px",
        }}
      >
        <ArchiveX size={14} color="#E64545" aria-hidden="true" />
        <h2
          style={{
            fontSize: "10.5px",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "#E64545",
            fontFamily: "ui-monospace, monospace",
            margin: 0,
            fontWeight: 700,
          }}
        >
          Corrections log · public correction record
        </h2>
      </header>
      <p
        style={{
          fontSize: "12px",
          lineHeight: 1.55,
          color: "var(--qgi-text-muted)",
          margin: "0 0 12px",
        }}
      >
        Recipes whose prior verdict was withdrawn after audit. Surfaced here on purpose:
        the honest counterpart to deployment.
      </p>

      {events.length === 0 ? (
        <div
          style={{ fontSize: "12px", color: "var(--qgi-text-dim)", fontStyle: "italic" }}
        >
          No corrections on record.
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {events.map((ev) => {
            return (
              <li
                key={ev.recipe_id + ev.vacated_at}
                style={{
                  padding: "12px",
                  border: "1px solid rgba(230,69,69,0.3)",
                  background: "rgba(230,69,69,0.05)",
                  borderRadius: "5px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      width: "28px",
                      height: "28px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--qgi-bg)",
                      border: "1px solid #E64545",
                      borderRadius: "4px",
                      color: "#E64545",
                      flexShrink: 0,
                    }}
                  >
                    <RecipeIcon recipeId={ev.recipe_id} size={16} strokeWidth={1.6} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      href={`/recipes/${ev.recipe_id}` as Route}
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--qgi-text)",
                        textDecoration: "none",
                      }}
                    >
                      {ev.label}
                    </Link>
                    <div
                      style={{
                        fontSize: "10px",
                        fontFamily: "ui-monospace, monospace",
                        color: "var(--qgi-text-dim)",
                        letterSpacing: "0.5px",
                        marginTop: "2px",
                      }}
                    >
                      {priorStatusLabel(ev.prior_status)} &#8594; WITHDRAWN ·{" "}
                      {ev.vacated_at}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "11.5px",
                    lineHeight: 1.55,
                    color: "var(--qgi-text-muted)",
                    marginTop: "6px",
                  }}
                >
                  <strong style={{ color: "var(--qgi-text)" }}>
                    {sanitizeNote(ev.cause)}.
                  </strong>{" "}
                  {sanitizeNote(ev.note)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
