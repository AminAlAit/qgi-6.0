import {
  GraduationCap,
  CircleX,
  Radio,
  Layers,
  Hourglass,
  Telescope,
  type LucideIcon,
} from "lucide-react";

interface TileProps {
  count: number;
  label: string;
  sublabel: string;
  Icon: LucideIcon;
  color: string;
  big?: boolean;
}

function ScoreTile({ count, label, sublabel, Icon, color, big }: TileProps) {
  return (
    <div
      style={{
        background: "var(--qgi-surface)",
        border: `1px solid ${color}66`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "8px",
        padding: big ? "20px 22px" : "16px 18px",
        display: "flex",
        alignItems: "flex-start",
        gap: "14px",
        minHeight: big ? "112px" : "92px",
        boxShadow: big ? `0 0 22px ${color}22` : "none",
      }}
    >
      <div
        style={{
          width: big ? "44px" : "36px",
          height: big ? "44px" : "36px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--qgi-bg)",
          border: `1px solid ${color}`,
          borderRadius: "6px",
          color,
        }}
      >
        <Icon size={big ? 24 : 20} strokeWidth={1.6} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
            fontSize: big ? "40px" : "30px",
            lineHeight: 1,
            color,
            letterSpacing: "-1px",
          }}
        >
          {count}
        </div>
        <div
          style={{
            marginTop: "8px",
            fontSize: "11px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            fontFamily: "ui-monospace, monospace",
            color: "var(--qgi-text)",
            fontWeight: 600,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--qgi-text-muted)",
            marginTop: "2px",
            lineHeight: 1.3,
          }}
        >
          {sublabel}
        </div>
      </div>
    </div>
  );
}

export function TrackerHero({
  graduated,
  walkedFail,
  inProgress,
  legacy,
  queued,
  total,
  vintage,
}: {
  graduated: number;
  walkedFail: number;
  inProgress: number;
  legacy: number;
  queued: number;
  total: number;
  vintage: string;
}) {
  return (
    <header style={{ marginBottom: "8px" }}>
      <div
        style={{
          color: "var(--qgi-accent)",
          fontSize: "10px",
          letterSpacing: "4px",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "8px",
        }}
      >
        Live Recipe Tracker
      </div>
      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div style={{ maxWidth: "780px" }}>
          <h1
            style={{
              fontSize: "34px",
              fontWeight: 600,
              lineHeight: 1.1,
              margin: "0 0 10px",
            }}
          >
            The scoreboard of the QGI research program
          </h1>
          <p
            style={{
              color: "var(--qgi-text-muted)",
              fontSize: "14px",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Every recipe walks the same pre-registered gates. Most fail. This page shows
            the program failing in public — that is the honesty signal. Click any row for
            the recipe&apos;s full 15-capability report card.
          </p>
        </div>
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: "10px",
            letterSpacing: "1px",
            color: "var(--qgi-text-dim)",
            padding: "6px 10px",
            background: "var(--qgi-surface)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "4px",
            whiteSpace: "nowrap",
          }}
        >
          Data as of {vintage}
        </div>
      </div>

      {/* Scoreboard tiles — sized by importance, the graduated tile is the headline */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr 1.1fr",
          gap: "12px",
        }}
      >
        <ScoreTile
          big
          count={graduated}
          label="Graduated"
          sublabel="Cleared every pre-reg gate"
          Icon={GraduationCap}
          color="#3FBF8F"
        />
        <ScoreTile
          count={walkedFail}
          label="Walked-failed"
          sublabel="Hard-failed a gate"
          Icon={CircleX}
          color="#E68F29"
        />
        <ScoreTile
          count={inProgress}
          label="In flight"
          sublabel="Walk running now"
          Icon={Radio}
          color="#a78bfa"
        />
        <ScoreTile
          count={legacy}
          label="Legacy ML-1"
          sublabel="Pre-TE, re-walk pending"
          Icon={Layers}
          color="#7A8FA0"
        />
        <ScoreTile
          count={queued}
          label="Queued"
          sublabel="Awaiting curated events"
          Icon={Hourglass}
          color="#64748b"
        />
        <ScoreTile
          count={total}
          label="Total catalog"
          sublabel="71 recipes · 8 L1 families"
          Icon={Telescope}
          color="#38bdf8"
        />
      </div>
    </header>
  );
}
