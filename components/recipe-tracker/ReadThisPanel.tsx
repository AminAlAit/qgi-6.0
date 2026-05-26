import { Info, GraduationCap, Target, ShieldAlert } from "lucide-react";

const BULLETS: Array<{ Icon: typeof Info; title: string; body: string }> = [
  {
    Icon: Target,
    title: "LOCO floor",
    body: "Leave-one-cohort-out AUC must clear 0.7986 — measured across six geographic cohorts, never on the country being scored.",
  },
  {
    Icon: GraduationCap,
    title: "V1 separation",
    body: "Pre-event country-years must score visibly higher than non-event years (separation gap, in percentage points).",
  },
  {
    Icon: Info,
    title: "Calibration ECE",
    body: "Probabilities are calibrated only if expected calibration error stays under 0.08. Foreign Intervention failed this in walk-3 — so we show ranks, not percentages.",
  },
  {
    Icon: ShieldAlert,
    title: "Coverage + chance gate",
    body: "≥50% positive survival and ≥30 positives after walk filters, beating a naive baseline. The vacated recipe failed this in audit — added 2026-05-25.",
  },
];

export function ReadThisPanel() {
  return (
    <section
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderLeft: "3px solid var(--qgi-accent)",
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
        <Info size={14} color="var(--qgi-accent)" />
        <h2
          style={{
            fontSize: "10.5px",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--qgi-accent)",
            fontFamily: "ui-monospace, monospace",
            margin: 0,
            fontWeight: 700,
          }}
        >
          How to read this
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
        Every recipe walks the same pre-registered gates (F-ML-1). Most fail. That&apos;s
        a feature, not a bug.
      </p>
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
        {BULLETS.map((b) => (
          <li
            key={b.title}
            style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}
          >
            <span
              style={{
                width: "22px",
                height: "22px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--qgi-bg)",
                border: "1px solid var(--qgi-border)",
                borderRadius: "4px",
                color: "var(--qgi-accent)",
              }}
            >
              <b.Icon size={13} strokeWidth={1.8} />
            </span>
            <div>
              <div
                style={{
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "var(--qgi-text)",
                  marginBottom: "2px",
                }}
              >
                {b.title}
              </div>
              <div
                style={{
                  fontSize: "11.5px",
                  lineHeight: 1.5,
                  color: "var(--qgi-text-muted)",
                }}
              >
                {b.body}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
