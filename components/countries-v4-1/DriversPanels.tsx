/**
 * DriversPanels (P2 + P3) — the attribution/movement pair.
 *
 * These answer two DIFFERENT questions and must stay visibly separate
 * (Kwame, non-negotiable): P2 "why these scores" is how the model weighs
 * signals (model-internal); P3 "what's moving" is what is observably
 * shifting in the world. They share the top-lit family accent so the reader
 * sees they describe the same recipe, but carry different eyebrows and a
 * bridge tooltip. Conflating them would imply the model's weights ARE
 * real-world causes, which we forbid.
 */
import { PanelShell } from "./PanelShell";
import { MiniSparkline } from "./MiniSparkline";
import type {
  CountryDriverAttribution,
  CountryDriverMovement,
} from "@/lib/te-mock/countries-v4-data";

const BRIDGE =
  "Weight and movement are different. An indicator can weigh heavily while sitting still, " +
  "or move sharply while weighing little.";

/* ── P2 — Why these scores (attribution) ─────────────────────────────── */
export function WhyScoresPanel({
  accent,
  topRecipeLabel,
  countryName,
  attribution,
}: {
  accent: string;
  topRecipeLabel: string;
  countryName: string;
  attribution: CountryDriverAttribution[];
}) {
  const rows = [...attribution].sort((a, b) => b.signal_share_pct - a.signal_share_pct);
  const max = Math.max(1, ...rows.map((r) => r.signal_share_pct));

  return (
    <PanelShell
      title="Why these scores"
      accent={accent}
      tooltip={BRIDGE}
      caption={`Which signals weigh most in ${countryName}'s top score (${topRecipeLabel}). This is how the model reads the data, not a cause.`}
    >
      {rows.length === 0 ? (
        <p
          style={{
            fontSize: "12px",
            color: "var(--qgi-text-dim)",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          No attribution available for this country yet.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {rows.map((r) => (
            <li key={r.indicator_code}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "10px",
                  marginBottom: "3px",
                }}
              >
                <span
                  style={{
                    fontSize: "12.5px",
                    color: "var(--qgi-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={`${r.indicator_name} (${r.provider})`}
                >
                  {r.indicator_name}
                  <span
                    style={{
                      fontSize: "9.5px",
                      color: "var(--qgi-text-dim)",
                      fontFamily: "ui-monospace, monospace",
                      marginLeft: "8px",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {r.provider}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: accent,
                    flexShrink: 0,
                  }}
                >
                  {r.signal_share_pct.toFixed(0)}%
                </span>
              </div>
              <div
                style={{
                  height: "8px",
                  borderRadius: "2px",
                  background: "var(--qgi-bg)",
                  border: "1px solid var(--qgi-border)",
                  overflow: "hidden",
                }}
                aria-hidden
              >
                <div
                  style={{
                    width: `${(r.signal_share_pct / max) * 100}%`,
                    height: "100%",
                    background: accent,
                    opacity: 0.85,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

/* ── P3 — What's moving (observed movement) ──────────────────────────── */
function DirectionGlyph({
  direction,
}: {
  direction: CountryDriverMovement["direction"];
}) {
  const g = direction === "rising" ? "▲" : direction === "falling" ? "▼" : "▬";
  return (
    <span
      style={{
        fontSize: "9px",
        color: "var(--qgi-text-dim)",
        fontFamily: "ui-monospace, monospace",
      }}
      aria-label={direction}
    >
      {g}
    </span>
  );
}

export function WhatsMovingPanel({
  accent,
  countryName,
  movement,
}: {
  accent: string;
  countryName: string;
  movement: CountryDriverMovement[];
}) {
  return (
    <PanelShell
      title="What's moving"
      accent={accent}
      tooltip={BRIDGE}
      caption={`How each indicator behind ${countryName}'s scores has actually shifted over the last 3 years. Recent movement only, not a projection.`}
    >
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "11px",
        }}
      >
        {movement.map((m) => {
          const z = m.z_score_change;
          return (
            <li
              key={m.indicator_code}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto auto",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span
                style={{
                  fontSize: "12.5px",
                  color: "var(--qgi-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={`${m.indicator_name} (${m.provider})`}
              >
                {m.indicator_name}
                <span
                  style={{
                    fontSize: "9.5px",
                    color: "var(--qgi-text-dim)",
                    fontFamily: "ui-monospace, monospace",
                    marginLeft: "8px",
                    letterSpacing: "0.3px",
                  }}
                >
                  {m.provider}
                </span>
              </span>
              <MiniSparkline
                values={m.trajectory}
                color={accent}
                width={104}
                height={26}
              />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "11.5px",
                  color: "var(--qgi-text-muted)",
                  minWidth: "52px",
                  justifyContent: "flex-end",
                }}
              >
                <DirectionGlyph direction={m.direction} />
                {z > 0 ? "+" : ""}
                {/* sub-1 changes keep a decimal so a real move never reads as 0 */}
                {Math.abs(z) < 1 ? z.toFixed(1) : z.toFixed(0)}
              </span>
            </li>
          );
        })}
      </ul>
    </PanelShell>
  );
}
