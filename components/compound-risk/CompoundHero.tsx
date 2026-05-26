import { Layers } from "lucide-react";

interface Props {
  litAtThreshold: number;
  minThreshold: number;
  totalCountries: number;
  vintage: string;
}

export function CompoundHero({
  litAtThreshold,
  minThreshold,
  totalCountries,
  vintage,
}: Props) {
  return (
    <section style={{ marginBottom: "8px" }}>
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
        Compound Risk
      </div>
      <h1
        style={{
          fontSize: "32px",
          fontWeight: 600,
          lineHeight: 1.15,
          margin: "0 0 16px",
        }}
      >
        Countries lighting up on more than one recipe
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 320px) 1fr",
          gap: "24px",
          alignItems: "stretch",
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "10px",
          padding: "24px",
        }}
      >
        {/* Big number */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            borderRight: "1px solid var(--qgi-border)",
            paddingRight: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
            }}
          >
            <Layers size={18} strokeWidth={1.6} color="var(--qgi-accent)" />
            <span
              style={{
                fontSize: "10px",
                letterSpacing: "1.5px",
                fontFamily: "ui-monospace, monospace",
                color: "var(--qgi-text-dim)",
                textTransform: "uppercase",
              }}
            >
              Currently compounded
            </span>
          </div>
          <div
            style={{
              fontSize: "88px",
              fontWeight: 600,
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-amber)",
              lineHeight: 1,
              letterSpacing: "-2px",
            }}
          >
            {litAtThreshold}
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "13px",
              color: "var(--qgi-text)",
              lineHeight: 1.45,
            }}
          >
            countries are currently lit on{" "}
            <strong style={{ color: "var(--qgi-amber)" }}>≥{minThreshold} recipes</strong>{" "}
            at once
          </div>
          <div
            style={{
              marginTop: "8px",
              fontSize: "10.5px",
              letterSpacing: "0.4px",
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-text-dim)",
            }}
          >
            of {totalCountries} country-cases tracked · vintage {vintage}
          </div>
        </div>

        {/* Explanation */}
        <div
          style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}
        >
          <p
            style={{
              fontSize: "14.5px",
              lineHeight: 1.6,
              color: "var(--qgi-text)",
              margin: "0 0 12px",
            }}
          >
            <strong>Compound risk</strong> is the structural condition where a{" "}
            <em>single state</em> is positioned high on{" "}
            <em>multiple, semantically-distinct</em> crisis recipes at the same time —
            civil-war shape <em>and</em> economic-recession shape <em>and</em>{" "}
            mass-protest shape, layered on the same body politic. Each recipe scores the
            country independently against its own canonical pre-event trajectory; the
            compound view stacks those positions and surfaces where the stack is tallest.
          </p>
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.55,
              color: "var(--qgi-text-muted)",
              margin: 0,
            }}
          >
            The page answers one question:{" "}
            <em>where do structural pressures pile up on the same state?</em> It does not
            claim those pressures interact causally, nor that the recipes will fire
            jointly. It is a multi-frame similarity read, surfaced honestly with each
            recipe&apos;s own tier and band carried through.
          </p>
        </div>
      </div>
    </section>
  );
}
