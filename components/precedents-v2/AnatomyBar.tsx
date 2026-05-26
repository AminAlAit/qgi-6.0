"use client";

const SECTIONS = [
  { num: 1, label: "Definition" },
  { num: 2, label: "Indicators" },
  { num: 3, label: "Window" },
  { num: 4, label: "Sample" },
  { num: 5, label: "Identity" },
  { num: 6, label: "Discrimination" },
  { num: 7, label: "Reliability" },
  { num: 8, label: "Top countries" },
  { num: 9, label: "Bottom countries" },
  { num: 10, label: "Distribution" },
  { num: 11, label: "Calibration" },
  { num: 12, label: "Recent" },
  { num: 13, label: "Patterns" },
  { num: 14, label: "Vintage" },
  { num: 15, label: "Sensitivity" },
];

export function AnatomyBar() {
  return (
    <nav
      aria-label="Capability sections"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "rgba(11,17,26,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--qgi-border)",
        padding: "10px 0",
        marginBottom: "0",
      }}
    >
      <div
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          gap: "4px",
          overflowX: "auto",
          fontSize: "10px",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {SECTIONS.map((s) => (
          <a
            key={s.num}
            href={`#cap-${s.num}`}
            style={{
              padding: "4px 8px",
              border: "1px solid var(--qgi-border)",
              borderRadius: "3px",
              color: "var(--qgi-text-muted)",
              textDecoration: "none",
              letterSpacing: "0.3px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            §{String(s.num).padStart(2, "0")} {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
