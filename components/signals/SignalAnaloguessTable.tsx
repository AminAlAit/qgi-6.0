/**
 * SignalAnaloguesTable — ranked table of historical country analogues for a
 * (subject_country, event_category) pair.
 *
 * Persona design (Yuki + Lena, 2026-05-01):
 *   - Ranked by best_pps descending (the most structurally similar precedent first)
 *   - Rows where event_in_window = true get a green left-border accent — the
 *     buyer's key signal that the reference event happened WITHIN the pattern window
 *   - CountryFlag for country_b visual scanning
 *   - avg_lead_years shown with a warning when negative (event co-occurred / preceded)
 *   - Mobile: horizontal scroll accepted (data density > card readability)
 */
import { CountryFlag } from "@/components/design/CountryFlag";

export interface AnalogueEntry {
  country_b_id: number;
  country_b_name: string;
  alpha2: string;
  recipe_count: number;
  mean_corr: number;
  best_pps: number;
  avg_lead_years: number;
  best_pattern_length: number;
  best_pattern_start_a: number;
  best_pattern_start_b: number;
  event_year_b: number;
  event_title_b: string;
  event_in_window: boolean;
  pair_length?: number;
  pair_pps?: number;
  pair_avg_corr?: number;
}

interface Props {
  analogues: AnalogueEntry[];
  subjectCountryName: string;
}

export function SignalAnaloguesTable({ analogues, subjectCountryName }: Props) {
  if (analogues.length === 0) {
    return (
      <div
        className="rounded-lg border p-6 text-center"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
      >
        <div
          className="text-[10px] tracking-widest uppercase mb-2"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Historical Analogues
        </div>
        <p className="text-[12px]" style={{ color: "var(--qgi-text-muted)" }}>
          No historical analogues available for {subjectCountryName} on this recipe.
        </p>
      </div>
    );
  }

  // Sort by best_pps desc
  const sorted = [...analogues].sort((a, b) => b.best_pps - a.best_pps).slice(0, 12);

  return (
    <div
      className="rounded-lg border"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      <div className="px-5 pt-5 pb-3">
        <div
          className="text-[10px] tracking-widest uppercase mb-1"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Historical Analogues
        </div>
        <p className="text-[11px]" style={{ color: "var(--qgi-text-muted)" }}>
          Countries whose indicator trajectories most closely preceded a matching event —
          ordered by pattern strength.
          <span
            className="ml-2 inline-flex items-center gap-1"
            style={{ color: "var(--qgi-success)" }}
          >
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ backgroundColor: "var(--qgi-success)", opacity: 0.6 }}
            />
            <span className="text-[9px] tracking-wider uppercase">Event in window</span>
          </span>
        </p>
      </div>

      {/* Table — horizontal scroll on mobile */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                borderTop: "1px solid var(--qgi-border)",
                borderBottom: "1px solid var(--qgi-border)",
              }}
            >
              {[
                "Precedent Country",
                "PPS",
                "Corr",
                "Lead Yrs",
                "Pattern",
                "Reference Event (in precedent)",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-left font-normal tracking-wider uppercase"
                  style={{ color: "var(--qgi-text-dim)", fontSize: 9 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((a, i) => {
              const inWindow = a.event_in_window;
              const leadNeg = a.avg_lead_years < 0;

              return (
                <tr
                  key={a.country_b_id}
                  style={{
                    borderBottom:
                      i < sorted.length - 1 ? "1px solid var(--qgi-border)" : "none",
                    backgroundColor: inWindow ? "rgba(52,211,153,0.04)" : "transparent",
                    borderLeft: inWindow
                      ? "2px solid var(--qgi-success)"
                      : "2px solid transparent",
                  }}
                >
                  {/* Country */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <CountryFlag alpha2={a.alpha2} size={14} ariaHidden />
                      <span style={{ color: "var(--qgi-text)" }}>{a.country_b_name}</span>
                    </div>
                  </td>

                  {/* PPS */}
                  <td className="px-4 py-2.5">
                    <span
                      className="font-data font-semibold"
                      style={{
                        color:
                          a.best_pps >= 80
                            ? "var(--qgi-success)"
                            : a.best_pps >= 50
                              ? "var(--qgi-amber)"
                              : "var(--qgi-text-muted)",
                      }}
                    >
                      {a.best_pps.toFixed(1)}
                    </span>
                  </td>

                  {/* Correlation */}
                  <td className="px-4 py-2.5">
                    <span
                      className="font-data"
                      style={{ color: "var(--qgi-text-muted)" }}
                    >
                      {(a.mean_corr * 100).toFixed(0)}%
                    </span>
                  </td>

                  {/* Lead years */}
                  <td className="px-4 py-2.5">
                    <span
                      className="font-data"
                      style={{
                        color: leadNeg ? "var(--qgi-warning)" : "var(--qgi-text-muted)",
                      }}
                      title={
                        leadNeg
                          ? "Negative lead: the event co-occurred with or preceded the pattern end in this precedent."
                          : undefined
                      }
                    >
                      {a.avg_lead_years > 0 ? "+" : ""}
                      {a.avg_lead_years.toFixed(1)}yr
                      {leadNeg && (
                        <span
                          className="ml-1"
                          style={{ color: "var(--qgi-warning)", fontSize: 9 }}
                        >
                          ⚑
                        </span>
                      )}
                    </span>
                  </td>

                  {/* Pattern window */}
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span
                      className="font-data text-[10px]"
                      style={{ color: "var(--qgi-text-muted)" }}
                    >
                      {a.best_pattern_start_a}–
                      {a.best_pattern_start_a + a.best_pattern_length}
                    </span>
                  </td>

                  {/* Reference event */}
                  <td className="px-4 py-2.5 max-w-xs">
                    <div
                      className="text-[10px] leading-snug"
                      style={{
                        color: inWindow ? "var(--qgi-success)" : "var(--qgi-text-muted)",
                      }}
                    >
                      {a.event_title_b}
                    </div>
                    <div
                      className="font-data text-[9px] mt-0.5"
                      style={{ color: "var(--qgi-text-dim)" }}
                    >
                      {a.event_year_b}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="px-5 py-3 text-[10px]"
        style={{
          borderTop: "1px solid var(--qgi-border)",
          color: "var(--qgi-text-dim)",
        }}
      >
        PPS = Pattern Power Score (higher = stronger structural match). Lead years =
        median time from pattern end to event in the precedent country. Negative lead =
        event co-occurred with pattern. Showing top {sorted.length} of {analogues.length}{" "}
        analogues.
      </div>
    </div>
  );
}
