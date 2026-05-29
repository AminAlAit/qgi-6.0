/**
 * AnalogsPanelV41 (P5) — the top historical situations whose pre-event
 * shape most resembles this country now. Archival-gold accent (signals
 * "history", distinct from the family palette).
 *
 * Hard phrasing rule (Kwame): "what happened next" is completed history
 * ABOUT THE ANALOG, attributed and dated, never joined to the subject
 * country by a predictive verb. The caption states similarity is not
 * prediction; the outcome text is presented as the analog's own past.
 */
import { PanelShell } from "./PanelShell";
import { FlagImg } from "./FlagImg";
import { flagFor } from "@/lib/te-mock/country-flags";
import type { CountryV4 } from "@/lib/te-mock/countries-v4-data";

const ARCHIVAL_GOLD = "#C9A66B";

export function AnalogsPanelV41({ country }: { country: CountryV4 }) {
  const hasAnalogs = country.analogs.length > 0;

  return (
    <PanelShell
      title="Historical analogs"
      accent={ARCHIVAL_GOLD}
      dataTour="analogs-panel"
      caption={
        hasAnalogs
          ? `Past situations whose recent pattern most resembles ${country.name} now. Similarity is not prediction; what follows is history about each analog, not a forecast about ${country.name}.`
          : `We surface the historical situations whose pre-event pattern most resembles a country's recent signals. ${country.name} is not in the current analog corpus.`
      }
    >
      {!hasAnalogs ? (
        <div
          style={{
            padding: "20px",
            border: "1px dashed var(--qgi-border)",
            background: "var(--qgi-bg)",
            borderRadius: "6px",
            color: "var(--qgi-text-muted)",
            fontSize: "12.5px",
            lineHeight: 1.55,
          }}
        >
          Historical analogs for {country.name} are in development. The current vintage
          covers 60 countries; coverage expands with each refresh.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {country.analogs.map((a, i) => (
            <div
              key={`${a.country}-${a.year}-${i}`}
              style={{
                border: "1px solid var(--qgi-border)",
                background: "var(--qgi-bg)",
                borderRadius: "6px",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "7px",
                  flexWrap: "wrap",
                }}
              >
                <FlagImg
                  emoji={flagFor(a.country)}
                  name={a.country}
                  width={22}
                  radius={2}
                />
                <span
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: "var(--qgi-text)",
                  }}
                >
                  {a.country}, {a.year}
                </span>
                <span
                  style={{
                    fontSize: "9.5px",
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.3px",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    color: ARCHIVAL_GOLD,
                    border: `1px solid ${ARCHIVAL_GOLD}66`,
                    background: `${ARCHIVAL_GOLD}12`,
                  }}
                  title="How closely this past situation's shape resembles the country now."
                >
                  {a.match_score.toFixed(0)}% match
                </span>
                {a.weak_analog && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--qgi-text-dim)",
                      fontStyle: "italic",
                    }}
                  >
                    weaker match, read with care
                  </span>
                )}
              </div>
              <p
                style={{
                  fontSize: "12.5px",
                  lineHeight: 1.55,
                  color: "var(--qgi-text-muted)",
                  margin: 0,
                }}
              >
                {a.what_happened_next}
              </p>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}
