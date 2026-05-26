import type { ReactNode } from "react";

interface Props {
  num: number;
  label: string;
  tier: "anatomy" | "results" | "firewall";
  gated?: boolean;
  gateMessage?: string;
  children?: ReactNode;
  id?: string;
}

export function CapabilitySection({
  num,
  label,
  tier,
  gated,
  gateMessage,
  children,
  id,
}: Props) {
  const tierColor =
    tier === "anatomy" ? "var(--qgi-accent)" : tier === "results" ? "#3FBF8F" : "#E64545";
  const tierLabel =
    tier === "anatomy" ? "Anatomy" : tier === "results" ? "Results" : "Firewall";
  return (
    <section
      id={id}
      style={{
        borderTop: "1px solid var(--qgi-border)",
        padding: "28px 0 8px",
        position: "relative",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "12px",
          marginBottom: "14px",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            letterSpacing: "1.5px",
            fontFamily: "ui-monospace, monospace",
            color: "var(--qgi-text-dim)",
          }}
        >
          §{String(num).padStart(2, "0")}
        </span>
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 600,
            margin: 0,
            color: "var(--qgi-text)",
            flex: 1,
          }}
        >
          {label}
        </h2>
        <span
          style={{
            fontSize: "9px",
            letterSpacing: "1px",
            padding: "2px 7px",
            border: `1px solid ${tierColor}`,
            color: tierColor,
            borderRadius: "3px",
            fontFamily: "ui-monospace, monospace",
            opacity: 0.85,
          }}
        >
          {tierLabel}
        </span>
      </header>
      {gated ? (
        <div
          style={{
            padding: "16px",
            background: "rgba(122,143,160,0.06)",
            border: "1px dashed var(--qgi-border)",
            borderRadius: "6px",
            color: "var(--qgi-text-dim)",
            fontSize: "13px",
            lineHeight: 1.55,
            fontStyle: "italic",
          }}
        >
          {gateMessage ??
            "Not yet evaluated — this section becomes visible after the first successful walk."}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
