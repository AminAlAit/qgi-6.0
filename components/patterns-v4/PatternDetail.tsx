/**
 * PatternDetail — per-pattern detail page body for /patterns-v4/[id].
 *
 * Section spine (matches the brief's 6-section spec):
 *   §1 Shape definition (large sparkline + window context)
 *   §2 Indicators (the 4 indicators that compose the shape)
 *   §3 Historical examples (5–8 country-years where this shape fired)
 *   §4 Current top matches (top-10 countries whose trajectory rhymes today)
 *   §5 How to read this shape (plain-English)
 *   §6 Anti-causal firewall (M8-R5 binding disclosure)
 *
 * Server component. Inline styles only, design tokens from globals.css.
 */
import Link from "next/link";
import type { Route } from "next";
import { iconForRecipe } from "@/lib/te-mock/icons";
import { getMock, type TrackerRecipe } from "@/lib/te-mock/recipes";
import { StatusChip } from "@/components/precedents-v2/StatusChip";
import type { PatternEntry } from "@/lib/te-mock/patterns-v4-data";
import { VocabularyQuarantineNote } from "./VocabularyQuarantineNote";
import { PatternShapeSparkline } from "./PatternShapeSparkline";
import { HistoricalExamplesList } from "./HistoricalExamplesList";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";

export interface PatternDetailProps {
  pattern: PatternEntry;
  recipe: TrackerRecipe;
}

export function PatternDetail({ pattern, recipe }: PatternDetailProps) {
  const mock = getMock(recipe);

  const shapeArchetype = describeArchetype(pattern.shape_points);

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Mockup banner — full width */}
      <div
        style={{
          background: "rgba(56,189,248,0.08)",
          borderBottom: "1px solid rgba(56,189,248,0.3)",
          padding: "7px 0",
          textAlign: "center",
          fontSize: "10.5px",
          color: "var(--qgi-accent)",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "1.5px",
        }}
      >
        MOCKUP · /patterns-v4 · local only
      </div>

      {/* Header strip */}
      <div
        style={{
          borderBottom: "1px solid var(--qgi-border)",
          background: "var(--qgi-surface)",
        }}
      >
        <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "20px 24px 24px" }}>
          {/* Breadcrumb */}
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "0.3px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "16px",
            }}
          >
            <Link
              href={"/patterns-v4" as Route}
              style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
            >
              ← Patterns
            </Link>
            <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
            <span style={{ color: pattern.l1_color }}>
              {pattern.l1_id} · {pattern.l1_label}
            </span>
            <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
            <span>{pattern.l2_label}</span>
          </div>

          <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
            <div
              style={{
                width: "96px",
                height: "96px",
                background: "var(--qgi-bg)",
                border: `1px solid ${pattern.l1_color}`,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: pattern.l1_color,
                flexShrink: 0,
              }}
            >
              <RecipeIcon recipeId={pattern.recipe_id} size={56} strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "8px",
                  flexWrap: "wrap",
                }}
              >
                <StatusChip status={pattern.status} size="md" />
                <span
                  style={{
                    fontSize: "10px",
                    padding: "3px 8px",
                    border: `1px solid ${pattern.l1_color}`,
                    color: pattern.l1_color,
                    borderRadius: "3px",
                    letterSpacing: "0.8px",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {pattern.l1_id} · {pattern.l1_label}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    padding: "3px 8px",
                    border: "1px dashed var(--qgi-accent)",
                    color: "var(--qgi-accent)",
                    borderRadius: "3px",
                    letterSpacing: "0.8px",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  Pattern · canonical shape
                </span>
              </div>
              <h1
                style={{
                  fontSize: "28px",
                  fontWeight: 600,
                  lineHeight: 1.15,
                  margin: "0 0 6px",
                }}
              >
                {pattern.name}
              </h1>
              <p style={{ color: "var(--qgi-text-muted)", fontSize: "13px", margin: 0 }}>
                Pattern{" "}
                <code style={{ fontFamily: "ui-monospace, monospace" }}>
                  {pattern.id}
                </code>{" "}
                · {mock.indicators.length} indicators · {pattern.window_y}y window ·{" "}
                {pattern.n_positives || "—"} verified positives
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "20px 24px 64px" }}>
        <VocabularyQuarantineNote />

        {/* §1 Shape definition */}
        <Section num={1} label="Shape definition">
          <p
            style={{
              fontSize: "13.5px",
              color: "var(--qgi-text-muted)",
              lineHeight: 1.6,
              maxWidth: "780px",
              margin: "0 0 14px",
            }}
          >
            The canonical movement shape derived from{" "}
            {pattern.n_positives || "the available"} verified historical positives. x-axis
            is years before the terminating event; y-axis is the standardized composite of
            the {mock.indicators.length} indicators below. Above the zero line sits the
            danger half; below it sits the benign half.
          </p>
          <div
            style={{
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "8px",
              padding: "16px 18px",
            }}
          >
            <PatternShapeSparkline
              points={pattern.shape_points}
              color={pattern.l1_color}
              windowY={pattern.window_y}
              variant="detail"
            />
            <div
              style={{
                fontSize: "11px",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.4px",
                marginTop: "10px",
                paddingTop: "10px",
                borderTop: "1px solid var(--qgi-border)",
              }}
            >
              Archetype: <span style={{ color: pattern.l1_color }}>{shapeArchetype}</span>
            </div>
          </div>
        </Section>

        {/* §2 Indicators */}
        <Section num={2} label="Indicators composing the shape">
          <p
            style={{
              fontSize: "13.5px",
              color: "var(--qgi-text-muted)",
              lineHeight: 1.55,
              margin: "0 0 12px",
              maxWidth: "780px",
            }}
          >
            The {mock.indicators.length} governance / political / economic indicators
            whose joint trajectory forms this canonical shape. Removing any one of them
            collapses the shape — see the firewall box at §6.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "10px",
            }}
          >
            {mock.indicators.map((ind) => (
              <div
                key={ind.code}
                style={{
                  padding: "12px",
                  background: "var(--qgi-surface)",
                  border: "1px solid var(--qgi-border)",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.8px",
                    color: "var(--qgi-text-dim)",
                    fontFamily: "ui-monospace, monospace",
                    marginBottom: "4px",
                  }}
                >
                  {ind.provider}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--qgi-text)",
                    marginBottom: "3px",
                  }}
                >
                  {ind.name}
                </div>
                <code
                  style={{
                    fontSize: "11px",
                    color: "var(--qgi-text-muted)",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {ind.code}
                </code>
              </div>
            ))}
          </div>
        </Section>

        {/* §3 Historical examples */}
        <Section num={3} label="Historical examples (where this shape fired)">
          <p
            style={{
              fontSize: "13.5px",
              color: "var(--qgi-text-muted)",
              lineHeight: 1.55,
              margin: "0 0 14px",
              maxWidth: "780px",
            }}
          >
            Country-years from the verified-positives corpus where this canonical shape
            ran to a terminating <strong>{pattern.name.toLowerCase()}</strong> event. Each
            line is <em>historical fact</em> about the analog country, never a statement
            about anyone&apos;s future.
          </p>
          <HistoricalExamplesList
            examples={pattern.historical_examples}
            l1Color={pattern.l1_color}
          />
        </Section>

        {/* §4 Current top matches */}
        <Section
          num={4}
          label="Current top-matches (countries whose trajectory most resembles this shape today)"
        >
          <p
            style={{
              fontSize: "13.5px",
              color: "var(--qgi-text-muted)",
              lineHeight: 1.55,
              margin: "0 0 14px",
              maxWidth: "780px",
            }}
          >
            Top-{pattern.current_top_matches.length} countries ranked by shape-similarity
            to the canonical shape, using each country&apos;s most recent{" "}
            {pattern.window_y}-year indicator window. Click a country to open its hub.
          </p>
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "6px",
            }}
          >
            {pattern.current_top_matches.map((m, i) => (
              <li
                key={m.country}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "11px 14px",
                  borderBottom:
                    i < pattern.current_top_matches.length - 1
                      ? "1px solid var(--qgi-border)"
                      : "none",
                }}
              >
                <span
                  style={{
                    width: "26px",
                    fontSize: "11px",
                    color: "var(--qgi-text-dim)",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  #{String(i + 1).padStart(2, "0")}
                </span>
                <Link
                  href={`/countries` as Route}
                  style={{
                    flex: 1,
                    fontSize: "13.5px",
                    color: "var(--qgi-text)",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  {m.country}
                </Link>
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--qgi-text-muted)",
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.3px",
                    padding: "2px 7px",
                    border: "1px solid var(--qgi-border)",
                    borderRadius: "3px",
                  }}
                >
                  {m.region}
                </span>
                <span
                  style={{
                    width: "80px",
                    height: "8px",
                    background: "var(--qgi-bg)",
                    border: "1px solid var(--qgi-border)",
                    borderRadius: "2px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  aria-hidden="true"
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: `${m.match_score}%`,
                      background: pattern.l1_color,
                      opacity: 0.85,
                    }}
                  />
                </span>
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "13px",
                    color: pattern.l1_color,
                    fontWeight: 600,
                    width: "48px",
                    textAlign: "right",
                  }}
                >
                  {m.match_score.toFixed(1)}
                </span>
              </li>
            ))}
          </ol>
          <div
            style={{
              fontSize: "11px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.3px",
              marginTop: "8px",
            }}
          >
            Match score = shape-similarity rank (0–100). Not a probability.
          </div>
        </Section>

        {/* §5 How to read */}
        <Section num={5} label="How to read this shape (plain English)">
          <div
            style={{
              padding: "16px 18px",
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderRadius: "6px",
              lineHeight: 1.65,
              fontSize: "13.5px",
              color: "var(--qgi-text)",
              maxWidth: "780px",
            }}
          >
            <p style={{ margin: "0 0 10px" }}>
              <strong>The shape is a fingerprint, not a forecast.</strong> Each historical{" "}
              {pattern.name.toLowerCase()} event in our verified-positives corpus left a
              similar imprint on the {mock.indicators.length} indicators above, over
              roughly {pattern.window_y} years. We average those imprints to get the
              canonical shape you see in §1.
            </p>
            <p style={{ margin: "0 0 10px" }}>
              <strong>A country &ldquo;matches&rdquo; this shape</strong> when its own
              recent {pattern.window_y}-year trajectory rhymes with that fingerprint. The{" "}
              {pattern.l1_color === "#7A8FA0" ? "match" : "match score"} in §4 is just
              that — how closely the country&apos;s curve mirrors the canonical one. Iran
              scoring 90 on the foreign-intervention shape does <em>not</em> mean a 90%
              chance of intervention; it means Iran&apos;s recent trajectory closely
              resembles the trajectories of the historical countries that ended up with
              one.
            </p>
            <p style={{ margin: 0 }}>
              <strong>What this is good for.</strong> Surfacing structural rhymes between
              today and the past — a starting point for analysis, not an endpoint. For
              probability calls, look only at{" "}
              <Link
                href={"/precedents-v2" as Route}
                style={{ color: "var(--qgi-accent)" }}
              >
                Validated (🟢) recipes
              </Link>{" "}
              with calibration disclosure.
            </p>
          </div>
        </Section>

        {/* §6 Anti-causal firewall */}
        <Section num={6} label="Anti-causal firewall (M8-R5)">
          <div
            style={{
              padding: "16px 18px",
              border: "1px solid #E64545",
              background: "rgba(230,69,69,0.06)",
              borderRadius: "6px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                letterSpacing: "1.4px",
                color: "#E64545",
                fontFamily: "ui-monospace, monospace",
                marginBottom: "10px",
                fontWeight: 600,
              }}
            >
              HONESTY-REGIME DISCLOSURE · M8-R5 BINDING
            </div>
            <p
              style={{
                fontSize: "13.5px",
                color: "var(--qgi-text)",
                lineHeight: 1.6,
                margin: "0 0 10px",
              }}
            >
              The match scores on this page are <strong>discrimination ranks</strong> —
              they describe how closely a country&apos;s present trajectory rhymes with
              the canonical shape, period. They are <strong>not probabilities</strong>,
              not odds, not forecasts. A country at 90 is not &ldquo;90% likely&rdquo; to
              see this event; it is positioned high in the distribution of shape
              similarity.
            </p>
            <p
              style={{
                fontSize: "12.5px",
                color: "var(--qgi-text-muted)",
                lineHeight: 1.6,
                margin: 0,
                fontStyle: "italic",
              }}
            >
              Removing any of the {mock.indicators.length} indicators in §2 degrades shape
              discrimination substantially; removing all four collapses match to chance.
              The shape signal is genuine, not a single-indicator artefact. Forward
              probability claims are gated on a separate calibration walk — see the
              recipe&apos;s{" "}
              <Link
                href={`/precedents-v2/${pattern.recipe_id}` as Route}
                style={{ color: "var(--qgi-accent)" }}
              >
                Precedents detail page
              </Link>{" "}
              for the calibration status of this recipe.
            </p>
          </div>
        </Section>

        {/* Cross-links */}
        <div
          style={{
            marginTop: "32px",
            paddingTop: "20px",
            borderTop: "1px solid var(--qgi-border)",
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            fontSize: "12px",
            color: "var(--qgi-text-muted)",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.3px",
          }}
        >
          <Link
            href={"/patterns-v4" as Route}
            style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
          >
            ← back to gallery
          </Link>
          <Link
            href={"/patterns-v4/ranking" as Route}
            style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
          >
            shape-discrimination ranking →
          </Link>
          <Link
            href={`/precedents-v2/${pattern.recipe_id}` as Route}
            style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
          >
            recipe detail (Precedents) →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  num,
  label,
  children,
}: {
  num: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        borderTop: "1px solid var(--qgi-border)",
        padding: "28px 0 8px",
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
          }}
        >
          {label}
        </h2>
      </header>
      {children}
    </section>
  );
}

/** Heuristic label for the shape curve — pure presentational text. */
function describeArchetype(points: number[]): string {
  const start = points[0];
  const end = points[points.length - 1];
  const mid = points[Math.floor(points.length / 2)];
  const rise = end - start;
  const oscRange = Math.max(...points) - Math.min(...points);
  if (oscRange > 2.4 && Math.abs(rise) < 1.0)
    return "Oscillating · cyclical mobilisation / electoral rhythm";
  if (rise > 1.8 && mid < (start + end) / 2 - 0.4)
    return "Late-collapse · slow drift then sharp tip";
  if (rise > 1.5) return "Ramp · sustained escalation toward event";
  if (rise < -0.5 && mid > end) return "U-shape · crisis trough then recovery";
  if (Math.abs(end - mid) > 1.3 && Math.abs(mid - start) < 0.5)
    return "Step · stable baseline then jump";
  return "Mixed shape · see indicator decomposition";
}
