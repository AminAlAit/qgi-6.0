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
  ariaLabel?: string;
}

function ScoreTile({ count, label, sublabel, Icon, color, big, ariaLabel }: TileProps) {
  return (
    <div
      aria-label={ariaLabel}
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
        aria-hidden="true"
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
        <Icon size={big ? 24 : 20} strokeWidth={1.6} aria-hidden="true" />
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
}: {
  graduated: number;
  walkedFail: number;
  inProgress: number;
  legacy: number;
  queued: number;
  total: number;
  /** @deprecated vintage stamp removed per V4.1 §2 — one stamp in the global
   *  header replaces all per-page stamps. Prop kept for backwards-compat only;
   *  no longer rendered. */
  vintage?: string;
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
        Recipe Tracker
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
          {/* V4.1 §5: short punchy h1, not a methodology abstract. */}
          <h1
            style={{
              fontSize: "34px",
              fontWeight: 600,
              lineHeight: 1.1,
              margin: "0 0 10px",
            }}
          >
            The Recipe Catalog
          </h1>
          {/* V4.1 §0 + §5: one-sentence subtitle. Confidence-first. */}
          <p
            style={{
              color: "var(--qgi-text-muted)",
              fontSize: "14px",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Every recipe is validated against the same checkpoints. Click any row for the
            full report card.
          </p>
        </div>
        {/* V4.1 §2: vintage stamp removed — lives in the global header. */}
      </div>

      {/* Scoreboard tiles — sized by importance, the graduated tile is the headline */}
      <section
        data-tour="tracker-hero-tiles"
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr 1.1fr",
          gap: "12px",
        }}
      >
        {/* V4.1 §4 vocabulary applied 2026-05-29 — every tile collapses onto
            the 4 audience buckets: Validated / In play / Coming soon / Prior
            version. Sublabels rewritten confidence-first per §0. */}
        <ScoreTile
          big
          count={graduated}
          label="Validated"
          sublabel="Cleared every validation check"
          Icon={GraduationCap}
          color="#3FBF8F"
          ariaLabel={`${graduated} recipes validated: cleared every validation check`}
        />
        <ScoreTile
          count={walkedFail}
          label="In play"
          sublabel="In active rotation, refining the next pass"
          Icon={CircleX}
          color="#5B7E99"
          ariaLabel={`${walkedFail} recipes in play: in active rotation, refining the next pass`}
        />
        <ScoreTile
          count={inProgress}
          label="In play"
          sublabel="Validation pass running now"
          Icon={Radio}
          color="#5B7E99"
          ariaLabel={`${inProgress} recipes in play: validation pass running now`}
        />
        <ScoreTile
          count={legacy}
          label="Prior version"
          sublabel="Pre-TE method, refresh underway"
          Icon={Layers}
          color="#7A8FA0"
          ariaLabel={`${legacy} recipes on a prior version: pre-TE method, refresh underway`}
        />
        <ScoreTile
          count={queued}
          label="Coming soon"
          sublabel="On the roadmap, awaiting case corpus"
          Icon={Hourglass}
          color="#64748b"
          ariaLabel={`${queued} recipes coming soon: on the roadmap, awaiting case corpus`}
        />
        <ScoreTile
          count={total}
          label="Total catalog"
          sublabel="71 recipes · 8 categories"
          Icon={Telescope}
          color="#38bdf8"
          ariaLabel={`${total} recipes total in the catalog across 8 categories`}
        />
      </section>
    </header>
  );
}
