import Link from "next/link";
import type { Route } from "next";
import type { TrackerRecipe } from "@/lib/te-mock/recipes";
import type { InFlightItem, QueuedItem } from "@/lib/te-mock/recipe-tracker-extra";
import { Radio, CalendarClock } from "lucide-react";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";

/** Sanitize data-layer note text: replace internal jargon with plain
 *  language before rendering. The data file is a read-only shared utility. */
function sanitizeNote(note: string): string {
  return note
    .replace(/F-ML-\d+/gi, "ML pre-registration")
    .replace(/F-ML-N/gi, "future ML pre-registration")
    .replace(/LOCO-AUC/g, "out-of-sample discrimination score")
    .replace(/\bLOCO\b/g, "out-of-sample discrimination")
    .replace(/\bvacated\b/gi, "withdrawn")
    .replace(/\bvacate\b/gi, "correction")
    .replace(/re-walk/gi, "re-validation")
    .replace(/\bwalk\b/gi, "validation pass")
    .replace(/\bin flight\b/gi, "in review")
    .replace(/\bfan-out\b/gi, "production rollout")
    .replace(/\btruncation\b/gi, "coverage gap");
}

export function InFlightPanel({
  inFlight,
  queued,
  recipes,
}: {
  inFlight: InFlightItem[];
  queued: QueuedItem[];
  recipes: TrackerRecipe[];
}) {
  const byId = Object.fromEntries(recipes.map((r) => [r.recipe_id, r]));
  return (
    <section
      data-tour="in-flight-panel"
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderLeft: "3px solid #a78bfa",
        borderRadius: "6px",
        padding: "16px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <Radio size={14} color="#a78bfa" aria-hidden="true" />
        <h2
          style={{
            fontSize: "10.5px",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "#a78bfa",
            fontFamily: "ui-monospace, monospace",
            margin: 0,
            fontWeight: 700,
          }}
        >
          Under validation and scheduled · next 30 days
        </h2>
      </header>

      {/* In-flight */}
      <div style={{ marginBottom: "14px" }}>
        <div
          style={{
            fontSize: "9.5px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "8px",
          }}
        >
          Running now ({inFlight.length})
        </div>
        {inFlight.length === 0 && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--qgi-text-dim)",
              fontStyle: "italic",
            }}
          >
            No validation passes running.
          </div>
        )}
        {inFlight.map((it) => {
          const r = byId[it.recipe_id];
          if (!r) return null;
          return (
            <Link
              key={it.recipe_id}
              href={`/precedents-v2/${r.recipe_id}` as Route}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "10px",
                background: "rgba(167,139,250,0.06)",
                border: "1px solid rgba(167,139,250,0.3)",
                borderRadius: "5px",
                marginBottom: "8px",
                textDecoration: "none",
                color: "inherit",
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
                  border: `1px solid ${r.l1_color}`,
                  borderRadius: "4px",
                  color: r.l1_color,
                  flexShrink: 0,
                }}
              >
                <RecipeIcon recipeId={r.recipe_id} size={16} strokeWidth={1.6} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "3px",
                  }}
                >
                  <PulsingDot color="#a78bfa" />
                  <span
                    style={{
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "var(--qgi-text)",
                    }}
                  >
                    {r.label}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "10.5px",
                    fontFamily: "ui-monospace, monospace",
                    color: "var(--qgi-text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  Stage {it.stage} · started {it.started_at} · ETA {it.eta}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--qgi-text-dim)",
                    marginTop: "4px",
                  }}
                >
                  {sanitizeNote(it.note)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Queued */}
      <div>
        <div
          style={{
            fontSize: "9.5px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <CalendarClock size={11} aria-hidden="true" /> Scheduled for next 30d
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {queued.map((it) => {
            const r = byId[it.recipe_id];
            if (!r) return null;
            return (
              <li
                key={it.recipe_id}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "8px",
                  padding: "6px 0",
                  borderTop: "1px solid var(--qgi-border)",
                  fontSize: "11.5px",
                }}
              >
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "10px",
                    color: "var(--qgi-text-dim)",
                    minWidth: "70px",
                  }}
                >
                  {it.eta}
                </span>
                <Link
                  href={`/precedents-v2/${r.recipe_id}` as Route}
                  style={{ color: "var(--qgi-text)", textDecoration: "none", flex: 1 }}
                >
                  {r.label}
                </Link>
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: r.l1_color,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                  title={`${r.l1_id} · ${r.l1_label}`}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function PulsingDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: "7px",
        height: "7px",
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 0 0 ${color}88`,
        animation: "qgi-tracker-pulse 1.6s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes qgi-tracker-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${color}88; opacity: 1; }
          50% { box-shadow: 0 0 0 5px ${color}00; opacity: 0.55; }
        }
      `}</style>
    </span>
  );
}
