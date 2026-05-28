import type { TrackerRecipe } from "@/lib/te-mock/recipes";
import type { WalkEvent } from "@/lib/te-mock/recipe-tracker-extra";

function colorForVerdict(v: WalkEvent["verdict"]): string {
  switch (v) {
    case "GRADUATED":
      return "#3FBF8F";
    case "VACATED":
      return "#E64545";
    case "HARD_FAIL":
      return "#E68F29";
    case "IN_FLIGHT":
      return "#a78bfa";
    default:
      return "#7A8FA0";
  }
}

/** Plain-language label for a verdict enum value used in tooltips/UI. */
function verdictLabel(v: WalkEvent["verdict"]): string {
  switch (v) {
    case "GRADUATED":
      return "Deployed";
    case "VACATED":
      return "Withdrawn";
    case "HARD_FAIL":
      return "Hard-fail";
    case "IN_FLIGHT":
      return "In review";
    case "MARGINAL":
      return "Marginal";
    default:
      return v;
  }
}

export function WalkTimeline({
  walks,
  recipes,
}: {
  walks: WalkEvent[];
  recipes: TrackerRecipe[];
}) {
  // Sort by fired_at chronological; project onto a 0..1 axis between min/max date.
  const sorted = [...walks].sort((a, b) => a.fired_at.localeCompare(b.fired_at));
  const labelById = Object.fromEntries(recipes.map((r) => [r.recipe_id, r.label]));

  const minT = new Date(sorted[0]?.fired_at ?? "2026-01-01").getTime();
  const maxT = new Date(sorted[sorted.length - 1]?.fired_at ?? "2026-12-31").getTime();
  const span = Math.max(maxT - minT, 1);

  const xFor = (iso: string) => {
    const t = new Date(iso).getTime();
    return ((t - minT) / span) * 100;
  };

  // Monthly tick labels — first of each month between minT and maxT
  const ticks: { x: number; label: string }[] = [];
  const cursor = new Date(minT);
  cursor.setDate(1);
  while (cursor.getTime() <= maxT) {
    ticks.push({
      x: xFor(cursor.toISOString()),
      label: cursor.toLocaleString("en-US", { month: "short" }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <section data-tour="walk-timeline" style={{ marginTop: "8px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <h2
          style={{
            fontSize: "11px",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            margin: 0,
          }}
        >
          Validation timeline · chronological
        </h2>
        <div
          style={{
            display: "flex",
            gap: "14px",
            fontSize: "10px",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <Swatch color="#3FBF8F" label="Deployed" />
          <Swatch color="#E68F29" label="Hard-fail" />
          <Swatch color="#a78bfa" label="In review" />
          <Swatch color="#E64545" label="Withdrawn" />
        </div>
      </div>

      <div
        style={{
          position: "relative",
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "6px",
          padding: "30px 24px 40px",
          height: "118px",
        }}
      >
        {/* Axis line */}
        <div
          style={{
            position: "absolute",
            left: "24px",
            right: "24px",
            top: "50%",
            height: "1px",
            background: "var(--qgi-border)",
          }}
        />

        {/* Walks */}
        <div
          style={{
            position: "absolute",
            left: "24px",
            right: "24px",
            top: "30px",
            bottom: "30px",
          }}
        >
          {sorted.map((w, i) => {
            const left = `${xFor(w.fired_at)}%`;
            const color = colorForVerdict(w.verdict);
            const label = labelById[w.recipe_id] ?? w.recipe_id;
            const above = i % 2 === 0;
            return (
              <a
                key={`${w.recipe_id}-${w.fired_at}`}
                href={`/recipes/${w.recipe_id}`}
                title={`${label} · ${w.fired_at} · ${verdictLabel(w.verdict)}${w.loco_auc ? ` · Discrimination score ${w.loco_auc.toFixed(3)}` : ""}`}
                aria-label={`${label} · ${w.fired_at} · ${verdictLabel(w.verdict)}`}
                style={{
                  position: "absolute",
                  left,
                  top: "50%",
                  /* 24×24 hit target (WCAG 2.5.8) via padding; negative margin keeps layout stable */
                  transform: "translate(-50%, -50%)",
                  width: "24px",
                  height: "24px",
                  margin: "-6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 2,
                  textDecoration: "none",
                  color: "transparent",
                  borderRadius: "50%",
                  outline: "none",
                }}
              >
                {/* Visual dot — 12×12, centered inside 24×24 hit area */}
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: color,
                    border: `2px solid var(--qgi-surface)`,
                    boxShadow: `0 0 0 1px ${color}, 0 0 8px ${color}66`,
                    flexShrink: 0,
                  }}
                />
                <style>{`
                  a[href*="/recipes/"]:focus-visible {
                    outline: 2px solid var(--qgi-accent, #38bdf8);
                    outline-offset: 2px;
                  }
                `}</style>
                <span
                  style={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                    [above ? "bottom" : "top"]: "16px",
                    fontSize: "9.5px",
                    fontFamily: "ui-monospace, monospace",
                    color: "var(--qgi-text-muted)",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}
                >
                  {label.length > 16 ? label.slice(0, 14) + "…" : label}
                </span>
              </a>
            );
          })}
        </div>

        {/* Tick marks */}
        <div
          style={{
            position: "absolute",
            left: "24px",
            right: "24px",
            bottom: "10px",
            height: "16px",
          }}
        >
          {ticks.map((t) => (
            <span
              key={t.label + t.x}
              style={{
                position: "absolute",
                left: `${t.x}%`,
                transform: "translateX(-50%)",
                fontSize: "9px",
                fontFamily: "ui-monospace, monospace",
                color: "var(--qgi-text-dim)",
                letterSpacing: "0.5px",
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        color: "var(--qgi-text-muted)",
      }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}88`,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}
