/**
 * GprConfirmationPanel — the per-country geopolitical-risk reading.
 *
 * Shown only for the 44 countries with a published academic benchmark (the
 * caller passes null otherwise, so the panel is simply absent elsewhere).
 * Confidence-first + honest: it shows how QGI-GPR has MOVED for this country
 * and a signal-quality tier; it never claims to reproduce the published index,
 * and no statistical jargon reaches the copy. Server component (no
 * interactivity); the sparkline ends at "today" and never points forward.
 */
import Link from "next/link";
import type { Route } from "next";
import { PanelShell } from "@/components/countries-v4-1/PanelShell";
import { MiniSparkline } from "@/components/countries-v4-1/MiniSparkline";
import type { GprCountryEntry, GprTier } from "@/lib/gpr/gpr-country-data";

// Archival violet — distinct from the structural family palette on this page.
const GPR_ACCENT = "#8B7CF6";

const TIER_TINT: Record<GprTier, string> = {
  A: "#3FBF8F", // Strong signal — calm green
  B: "var(--qgi-accent)", // Confirmed signal — accent
  C: "var(--qgi-text-muted)", // Weak signal — muted
};

function yearRange(window: string): string {
  // window is "YYYY-MM to YYYY-MM"
  const years = window.match(/\d{4}/g);
  return years && years.length >= 2
    ? `${years[0]} to ${years[years.length - 1]}`
    : window;
}

export function GprConfirmationPanel({ entry }: { entry: GprCountryEntry }) {
  if (!entry) return null;
  const { values } = entry.series;
  const tint = TIER_TINT[entry.tier];

  // The proxy series is a 0-1 score; frame the sparkline to the country's own
  // range so the movement shape is legible instead of flat against a 0-100 axis.
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const pad = (hi - lo) * 0.1 || 0.05;

  return (
    <PanelShell
      fullWidth
      title="GEOPOLITICAL RISK SIGNAL"
      accent={GPR_ACCENT}
      tooltip="QGI builds its own geopolitical-risk reading for every country from the global news record, and checks it against the published academic benchmark where one exists. The line shows how that reading has moved here; the badge shows how well it checks against the benchmark."
      caption={
        <>
          How {entry.name}&rsquo;s geopolitical risk has moved, {yearRange(entry.window)}.
          QGI-GPR tracks the direction and spikes of risk, not an absolute level.
        </>
      }
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "18px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.5px",
            color: tint,
            border: `1px solid ${tint}`,
            background: `color-mix(in srgb, ${tint} 10%, transparent)`,
            borderRadius: "10px",
            padding: "3px 10px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {entry.tier_label}
        </span>
        <MiniSparkline
          values={values}
          color={tint}
          width={360}
          height={48}
          min={lo - pad}
          max={hi + pad}
        />
      </div>
      <div
        style={{
          marginTop: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          fontSize: "11px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.3px",
        }}
      >
        <span>Validated against the published benchmark · {entry.n_months} months</span>
        <Link
          href={"/methodology/gpr" as Route}
          style={{
            color: GPR_ACCENT,
            textDecoration: "none",
            borderBottom: `1px solid color-mix(in srgb, ${GPR_ACCENT} 50%, transparent)`,
          }}
        >
          How we validate this &rarr;
        </Link>
      </div>
    </PanelShell>
  );
}
