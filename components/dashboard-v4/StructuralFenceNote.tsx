export function StructuralFenceNote() {
  return (
    <section style={{ marginBottom: "32px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "12px",
          marginBottom: "12px",
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
          §04
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
          What this dashboard is NOT
        </h2>
        <span
          style={{
            fontSize: "10px",
            color: "#E68F29",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.8px",
          }}
        >
          M8-R5 · honesty regime
        </span>
      </div>
      <div
        style={{
          padding: "18px 20px",
          border: "1px solid #E68F29",
          borderLeft: "3px solid #E68F29",
          background: "rgba(230, 143, 41, 0.06)",
          borderRadius: "8px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        <FenceRule
          n="01"
          title="This is not a forecast page."
          body={
            <>
              Nothing here says &ldquo;country X is N% likely to do Y by date Z.&rdquo;
              QGI&apos;s methodology is <strong>discrimination, not prediction</strong> —
              it separates pre-event years from non-event years on shape, and a high score
              means a country currently <em>resembles</em> a validated crisis shape, not
              that the crisis will fire.
            </>
          }
        />
        <FenceRule
          n="02"
          title="Numbers here are counts and ranks."
          body={
            <>
              Recipe counts (graduated, walked, queued) are integers from the
              source-of-truth tracker JSON. Country scores are{" "}
              <strong>discrimination ranks 0–100</strong>, not probabilities. A 98 means
              &ldquo;positioned high in the distribution of countries whose movement shape
              resembles this recipe.&rdquo; That is all.
            </>
          }
        />
        <FenceRule
          n="03"
          title="The dashboard aggregates, it never upgrades a tier."
          body={
            <>
              A walked-but-not-graduated recipe surfaces here as walked-not-graduated. A
              legacy ML-1 recipe surfaces as legacy. The dashboard is a <em>sampler</em>;
              the tier contract is whatever the source surface says — never softened in
              transit, never promoted by aggregation.
            </>
          }
        />
        <FenceRule
          n="04"
          title="Today, zero recipes are validated."
          body={
            <>
              The graduated count is honestly 0 in the current vintage — the only prior
              graduation (foreign_intervention) was publicly <strong>vacated</strong> on
              2026-05-25 after a sample-truncation leak was found. A re-walk under the
              pipeline-coverage fix is in flight. The program failing in public is the
              page&apos;s point.
            </>
          }
        />
      </div>
    </section>
  );
}

function FenceRule({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "1.2px",
          color: "#E68F29",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "6px",
        }}
      >
        §{n}
      </div>
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--qgi-text)",
          marginBottom: "5px",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "12.5px", color: "var(--qgi-text)", lineHeight: 1.55 }}>
        {body}
      </div>
    </div>
  );
}
