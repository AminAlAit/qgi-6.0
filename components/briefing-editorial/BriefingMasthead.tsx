/**
 * BriefingMasthead — full-width editorial masthead strip.
 *
 * Left: QG INTELLIGENCE wordmark (Century Gothic via inline font-family).
 * Centre: release cadence + vintage.
 * Right: live-status pip.
 *
 * Server component — no "use client".
 */

interface BriefingMastheadProps {
  vintage: string;
  vintageQuarter: string;
  isLive: boolean;
}

export function BriefingMasthead({
  vintage,
  vintageQuarter,
  isLive,
}: BriefingMastheadProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0 10px",
        borderBottom: "1px solid var(--qgi-border)",
        flexWrap: "wrap",
        gap: "8px",
      }}
    >
      {/* Wordmark */}
      <span
        style={{
          fontFamily: "'Century Gothic', 'AppleGothic', 'Century', sans-serif",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "5px",
          textTransform: "uppercase",
          color: "var(--qgi-text)",
        }}
      >
        QG INTELLIGENCE
      </span>

      {/* Centre: cadence + vintage quarter. Full ISO version is surfaced as a
          tooltip to keep the header clean — the release quarter is the
          user-facing label; the build timestamp is an internal artifact. */}
      <span
        title={`v${vintage}`}
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: "11px",
          color: "var(--qgi-text-dim)",
          letterSpacing: "0.5px",
          cursor: "default",
        }}
      >
        BRIEFING · {vintageQuarter}
      </span>

      {/* Live status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontFamily: "ui-monospace, monospace",
          fontSize: "10px",
          color: isLive ? "var(--qgi-success)" : "var(--qgi-text-dim)",
          letterSpacing: "1px",
        }}
      >
        {isLive ? (
          <>
            <style>{`
              @keyframes qgi-pip-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
              }
              .qgi-live-pip { animation: qgi-pip-pulse 1.8s ease-in-out infinite; }
            `}</style>
            <span
              className="qgi-live-pip"
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--qgi-success)",
                flexShrink: 0,
              }}
            />
            LIVE
          </>
        ) : (
          <>
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--qgi-text-dim)",
                opacity: 0.5,
                flexShrink: 0,
              }}
            />
            OFFLINE
          </>
        )}
      </div>
    </div>
  );
}
