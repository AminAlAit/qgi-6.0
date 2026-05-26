/**
 * HistoricalExamplesList — table of country-year cases where this canonical
 * movement shape fired in the past. M8-R5 binding: every line is HISTORICAL
 * FACT about the analog country, never a forecast.
 *
 * Used in PatternDetail §3. Server component.
 */
import type { HistoricalExample } from "@/lib/te-mock/patterns-v4-data";

export interface HistoricalExamplesListProps {
  examples: HistoricalExample[];
  l1Color: string;
}

export function HistoricalExamplesList({
  examples,
  l1Color,
}: HistoricalExamplesListProps) {
  if (!examples.length) {
    return (
      <p
        style={{ fontSize: "13px", color: "var(--qgi-text-muted)", fontStyle: "italic" }}
      >
        Verified historical examples not yet curated. Awaiting events-corpus ingestion.
      </p>
    );
  }
  return (
    <ol
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {examples.map((ex, i) => (
        <li
          key={`${ex.country}-${ex.year}`}
          style={{
            display: "flex",
            gap: "14px",
            alignItems: "flex-start",
            padding: "10px 12px",
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderLeft: `2px solid ${l1Color}`,
            borderRadius: "5px",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: "62px",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            <div
              style={{
                fontSize: "9px",
                letterSpacing: "1px",
                color: "var(--qgi-text-dim)",
              }}
            >
              #{String(i + 1).padStart(2, "0")}
            </div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: l1Color,
                marginTop: "2px",
              }}
            >
              {ex.year}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--qgi-text)",
                marginBottom: "3px",
              }}
            >
              {ex.country}
            </div>
            <p
              style={{
                fontSize: "12.5px",
                color: "var(--qgi-text-muted)",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {ex.event_summary}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
