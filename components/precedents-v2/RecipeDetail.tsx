import Link from "next/link";
import type { Route } from "next";
import { iconForRecipe } from "@/lib/te-mock/icons";
import {
  getMock,
  isDemoGraduated,
  vintageStamp,
  type TrackerRecipe,
} from "@/lib/te-mock/recipes";
import { CapabilitySection } from "./CapabilitySection";
import { AnatomyBar } from "./AnatomyBar";
import { StatusChip, STATUS_META } from "./StatusChip";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";
import { CALM_SLATE_BLUE } from "@/lib/te-mock/l1-families";

function VacatedMetric({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: "4px" }}>
      <span style={{ textDecoration: "line-through", color: "var(--qgi-text-dim)" }}>
        {children}
      </span>
      <span
        title="This number was vacated on 2026-05-25 after a sample-coverage error. Re-evaluation in progress."
        style={{
          fontSize: "8px",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.4px",
          color: "#E68F29",
          border: "1px solid #E68F29",
          background: "rgba(230,143,41,0.10)",
          padding: "1px 4px",
          borderRadius: "2px",
          textTransform: "uppercase",
          verticalAlign: "super",
        }}
      >
        vacated
      </span>
    </span>
  );
}

export function RecipeDetail({ recipe }: { recipe: TrackerRecipe }) {
  const mock = getMock(recipe);
  const demo = isDemoGraduated(recipe);
  const effectiveStatus = demo ? "graduated" : recipe.status;
  const showResults = effectiveStatus === "graduated";
  const isWalkedFail = recipe.status === "walked_no_graduation";
  const isQueued = recipe.status === "queued";
  const isLegacy = recipe.status === "live_legacy";

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Header strip */}
      <div
        style={{
          borderBottom: "1px solid var(--qgi-border)",
          background: "var(--qgi-surface)",
        }}
      >
        <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "20px 24px 24px" }}>
          {/* Breadcrumb + mockup banner */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                letterSpacing: "0.3px",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              <Link
                href={"/recipes" as Route}
                style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
              >
                ← Recipes
              </Link>
              <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
              <span style={{ color: recipe.l1_color }}>
                {recipe.l1_id} · {recipe.l1_label}
              </span>
              <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
              <span>{recipe.l2_label}</span>
            </div>
            <span
              style={{
                fontSize: "10px",
                padding: "3px 9px",
                border: "1px solid var(--qgi-accent)",
                color: "var(--qgi-accent)",
                borderRadius: "3px",
                letterSpacing: "1.2px",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              MOCKUP
            </span>
          </div>

          <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
            <div
              style={{
                width: "96px",
                height: "96px",
                background: "var(--qgi-bg)",
                border: `1px solid ${recipe.l1_color}`,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: recipe.l1_color,
                flexShrink: 0,
              }}
            >
              <RecipeIcon recipeId={recipe.recipe_id} size={56} strokeWidth={1.5} />
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
                <StatusChip status={effectiveStatus} size="md" />
                {demo && (
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
                    Demo render
                  </span>
                )}
              </div>
              <h1
                style={{
                  fontSize: "28px",
                  fontWeight: 600,
                  lineHeight: 1.15,
                  margin: "0 0 6px",
                }}
              >
                {recipe.label}
              </h1>
              <p style={{ color: "var(--qgi-text-muted)", fontSize: "13px", margin: 0 }}>
                Recipe ID{" "}
                <code style={{ fontFamily: "ui-monospace, monospace" }}>
                  {recipe.recipe_id}
                </code>{" "}
                · {mock.indicators.length} indicators · {mock.window}y window
              </p>
              {demo && (
                <p
                  style={{
                    marginTop: "10px",
                    marginBottom: 0,
                    padding: "8px 12px",
                    border: "1px dashed var(--qgi-accent)",
                    borderRadius: "4px",
                    background: "rgba(56,189,248,0.06)",
                    fontSize: "11.5px",
                    lineHeight: 1.5,
                    color: "var(--qgi-text-muted)",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  <strong style={{ color: "var(--qgi-accent)" }}>Real status:</strong>{" "}
                  {STATUS_META[recipe.status].label.toLowerCase()} (graduation vacated
                  2026-05-25 — F-ML-1 sample-truncation leak; prior LOCO-AUC 0.9147
                  reduced to ≈0.50 on full history). Rendered here as graduated to show
                  what a populated detail page looks like. Real surface lives on{" "}
                  <Link
                    href={"/recipe-tracker" as Route}
                    style={{ color: "var(--qgi-accent)" }}
                  >
                    /recipe-tracker
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky anatomy bar */}
      <AnatomyBar />

      {/* Body */}
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "0 24px 64px" }}>
        {/* §1 Definition */}
        <CapabilitySection
          id="cap-1"
          num={1}
          label="Definition & semantic identity"
          tier="anatomy"
        >
          <p style={{ fontSize: "15px", lineHeight: 1.65, color: "var(--qgi-text)" }}>
            {mock.definition}
          </p>
        </CapabilitySection>

        {/* §2 Indicators */}
        <CapabilitySection id="cap-2" num={2} label="Indicator set" tier="anatomy">
          <p
            style={{
              fontSize: "13px",
              color: "var(--qgi-text-muted)",
              marginBottom: "12px",
            }}
          >
            The four governance / political / economic indicators whose movement shape
            forms this recipe.
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
        </CapabilitySection>

        {/* §3 Window */}
        <CapabilitySection id="cap-3" num={3} label="Optimal window" tier="anatomy">
          <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
            <div
              style={{
                fontSize: "48px",
                fontWeight: 600,
                color: recipe.l1_color,
                fontFamily: "ui-monospace, monospace",
                lineHeight: 1,
              }}
            >
              {mock.window}y
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "var(--qgi-text-muted)",
                lineHeight: 1.5,
              }}
            >
              Length of the lead-time window in which the {mock.indicators.length}
              -indicator movement shape best predicts the {recipe.label.toLowerCase()}{" "}
              event. Selected from the{" "}
              {recipe.label === "Foreign Intervention" ? "15–25 year" : "3–25 year"} sweep
              using LOCO-AUC.
            </div>
          </div>
        </CapabilitySection>

        {/* §4 Sample */}
        <CapabilitySection
          id="cap-4"
          num={4}
          label="Sample-size sufficiency"
          tier="anatomy"
        >
          {mock.nPositives ? (
            <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
              <Stat label="Verified positives" value={mock.nPositives.toLocaleString()} />
              <Stat label="LOCO cohorts" value="6" />
              <Stat label="≥60-pos threshold" value="met" emphasis />
            </div>
          ) : (
            <p
              style={{
                fontSize: "13px",
                color: "var(--qgi-text-muted)",
                fontStyle: "italic",
              }}
            >
              Verified-positive count below the 60-event walk threshold today. Awaiting
              further curated-events ingestion before the first walk fires.
            </p>
          )}
        </CapabilitySection>

        {/* §5 Identity card */}
        <CapabilitySection id="cap-5" num={5} label="Identity card" tier="anatomy">
          <div
            style={{
              padding: "18px",
              border: `1px solid ${recipe.l1_color}`,
              background: "rgba(255,255,255,0.02)",
              borderRadius: "8px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "16px",
            }}
          >
            <Field k="L1 family" v={`${recipe.l1_id} · ${recipe.l1_label}`} />
            <Field k="L2 sub-class" v={recipe.l2_label} />
            <Field k="Window (years)" v={`${mock.window}y`} />
            <Field k="Indicators" v={String(mock.indicators.length)} />
            <Field k="Status" v={effectiveStatus.replace(/_/g, " ")} />
            <Field k="Vintage" v={isQueued ? "—" : vintageStamp()} />
          </div>
        </CapabilitySection>

        {/* §6 Discrimination */}
        <CapabilitySection
          id="cap-6"
          num={6}
          label="Discrimination (LOCO-AUC)"
          tier="results"
          gated={isQueued || isLegacy}
          gateMessage={
            isLegacy
              ? "Legacy ML-1 recipe — discrimination metric was not measured in the LOCO-AUC framework. Re-walk under TE pending."
              : "First walk not yet fired."
          }
        >
          {showResults && (
            <div
              style={{
                display: "flex",
                gap: "32px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: "56px",
                  fontWeight: 600,
                  color: demo ? "var(--qgi-text-dim)" : "#3FBF8F",
                  fontFamily: "ui-monospace, monospace",
                  lineHeight: 1,
                }}
              >
                {demo ? <VacatedMetric>0.91</VacatedMetric> : "0.91"}
              </div>
              <div style={{ flex: 1, minWidth: "240px" }}>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--qgi-text)",
                    marginBottom: "6px",
                  }}
                >
                  LOCO-AUC ={" "}
                  <strong>
                    {demo ? <VacatedMetric>0.9147</VacatedMetric> : "0.9147"}
                  </strong>{" "}
                  (95% CI{" "}
                  {demo ? <VacatedMetric>0.872–0.948</VacatedMetric> : "0.872 – 0.948"})
                  across 6 leave-one-cohort-out folds.
                </div>
                <div style={{ fontSize: "12px", color: "var(--qgi-text-muted)" }}>
                  {demo ? (
                    <>
                      <VacatedMetric>
                        Exceeds the LOCK floor of 0.7986 by +0.116
                      </VacatedMetric>
                      . V1 separation <VacatedMetric>25.8pp</VacatedMetric>.
                    </>
                  ) : (
                    <>Exceeds the LOCK floor of 0.7986 by +0.116. V1 separation 25.8pp.</>
                  )}
                </div>
              </div>
            </div>
          )}
          {isWalkedFail && !demo && (
            <div
              style={{
                padding: "14px",
                border: "1px solid #E68F29",
                background: "rgba(230,143,41,0.08)",
                borderRadius: "6px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--qgi-text)",
                  marginBottom: "6px",
                }}
              >
                LOCO-AUC ={" "}
                <strong style={{ color: "#E68F29" }}>
                  {recipe.stats?.loco_auc?.toFixed(4) ?? "—"}
                </strong>{" "}
                · Verdict: <strong style={{ color: "#E64545" }}>HARD-FAIL</strong>
              </div>
              <div style={{ fontSize: "12px", color: "var(--qgi-text-muted)" }}>
                Below the LOCK floor of 0.7986. Hard-core ML mechanic validated;
                protective-belt threshold (§4.2 of F-ML-1) did not clear. See public
                DECISION ratification for full breakdown.
              </div>
            </div>
          )}
        </CapabilitySection>

        {/* §7 Reliability */}
        <CapabilitySection
          id="cap-7"
          num={7}
          label="Reliability (held-out walks)"
          tier="results"
          gated={!showResults}
          gateMessage="Held-out walk metrics become available after graduation."
        >
          {demo ? (
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <StatNode label="V1 separation">
                <VacatedMetric>+25.8pp</VacatedMetric>
              </StatNode>
              <StatNode label="V4 OOT recall">
                <VacatedMetric>86.7%</VacatedMetric>
              </StatNode>
              <StatNode label="Walks completed">
                <VacatedMetric>4 (3 cleared + 1 vacated)</VacatedMetric>
              </StatNode>
              <StatNode label="Verdict">
                <VacatedMetric>LOCKED</VacatedMetric>
              </StatNode>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <Stat label="V1 separation" value="25.8pp" />
              <Stat label="V4 OOT recall" value="86.7%" />
              <Stat label="Walks completed" value="4" />
              <Stat label="Verdict" value="LOCKED" emphasis />
            </div>
          )}
        </CapabilitySection>

        {/* §8 Top countries */}
        <CapabilitySection
          id="cap-8"
          num={8}
          label="Top scoring countries"
          tier="results"
          gated={!showResults}
          gateMessage="Country rankings are published only after the first successful walk."
        >
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {mock.countriesTop.map((c, i) => (
              <li
                key={c.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom:
                    i < mock.countriesTop.length - 1
                      ? "1px solid var(--qgi-border)"
                      : "none",
                }}
              >
                <span
                  style={{
                    width: "28px",
                    fontSize: "11px",
                    color: "var(--qgi-text-dim)",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontSize: "14px", color: "var(--qgi-text)" }}>
                  {c.name}
                </span>
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "13px",
                    color: recipe.l1_color,
                    fontWeight: 600,
                  }}
                >
                  {c.score.toFixed(1)}
                </span>
              </li>
            ))}
          </ol>
        </CapabilitySection>

        {/* §9 Bottom countries */}
        <CapabilitySection
          id="cap-9"
          num={9}
          label="Bottom scoring countries"
          tier="results"
          gated={!showResults}
          gateMessage="Bottom rankings paired with top rankings; gated on first walk."
        >
          <p style={{ fontSize: "13px", color: "var(--qgi-text-muted)" }}>
            Switzerland (5.2), Iceland (5.8), Norway (6.4), New Zealand (7.1), Finland
            (8.3) — five lowest-scoring countries by the same {mock.window}-year movement
            profile.
          </p>
        </CapabilitySection>

        {/* §10 Distribution */}
        <CapabilitySection
          id="cap-10"
          num={10}
          label="Score distribution"
          tier="results"
          gated={!showResults}
        >
          <div
            style={{
              height: "80px",
              background:
                "linear-gradient(to right, rgba(167,139,250,0.0) 0%, rgba(167,139,250,0.3) 30%, rgba(167,139,250,0.7) 65%, rgba(63,191,143,0.6) 90%, rgba(63,191,143,0.0) 100%)",
              borderRadius: "4px",
              border: "1px solid var(--qgi-border)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: "4px",
                left: "8px",
                fontSize: "10px",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              0
            </div>
            <div
              style={{
                position: "absolute",
                bottom: "4px",
                right: "8px",
                fontSize: "10px",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              100
            </div>
          </div>
          <p
            style={{
              fontSize: "12px",
              color: "var(--qgi-text-muted)",
              marginTop: "10px",
            }}
          >
            Right-skewed distribution; median 24, 90th-pct 68, max 98.
          </p>
        </CapabilitySection>

        {/* §11 Calibration */}
        <CapabilitySection
          id="cap-11"
          num={11}
          label="Calibration disclosure"
          tier="results"
          gated={isQueued || isLegacy}
          gateMessage={
            isLegacy
              ? "Calibration not measured for legacy ML-1 recipes."
              : "First walk not yet fired."
          }
        >
          <div
            style={{
              padding: "14px",
              border: "1px solid var(--qgi-border)",
              background: "rgba(255,255,255,0.02)",
              borderRadius: "6px",
              borderLeft: "3px solid #E68F29",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                letterSpacing: "1px",
                color: "#E68F29",
                fontFamily: "ui-monospace, monospace",
                marginBottom: "6px",
              }}
            >
              HONESTY-REGIME DISCLOSURE · M8-R5
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--qgi-text)",
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              Walk-3 Beta calibration ECE failed. Scores on this page are{" "}
              <strong>discrimination ranks, not probabilities</strong>. A country scoring
              80 is not &ldquo;80% likely&rdquo; to experience the event — it is
              positioned high in the distribution of countries whose movement shape
              resembles the recipe.
            </p>
          </div>
        </CapabilitySection>

        {/* §12 Recent additions */}
        <CapabilitySection
          id="cap-12"
          num={12}
          label="Precedents"
          tier="results"
          gated={!showResults}
          gateMessage="Recent-event log gated on first walk."
        >
          <ul
            style={{ listStyle: "none", padding: 0, fontSize: "13px", lineHeight: 1.8 }}
          >
            <li style={{ color: "var(--qgi-text-muted)" }}>
              2025 · Mali — added (Wagner extension)
            </li>
            <li style={{ color: "var(--qgi-text-muted)" }}>
              2024 · Niger — added (post-coup deployment)
            </li>
            <li style={{ color: "var(--qgi-text-muted)" }}>
              2023 · Sudan — vacated (intra-state, not foreign)
            </li>
          </ul>
        </CapabilitySection>

        {/* §13 Pattern alignment */}
        <CapabilitySection
          id="cap-13"
          num={13}
          label="Pattern-level alignment"
          tier="results"
          gated={true}
          gateMessage="Pattern-to-recipe alignment surfaces in a future build. Not in this mockup."
        />

        {/* §14 Vintage */}
        <CapabilitySection
          id="cap-14"
          num={14}
          label="Vintage stamp + cohort"
          tier="anatomy"
        >
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <Stat label="Tracker vintage" value={isQueued ? "—" : vintageStamp()} />
            <Stat label="Walk #" value={isQueued ? "—" : "v4"} />
            <Stat label="Cohort" value="LOCO-6" />
            <Stat label="Ratified by" value="Majles (8/8)" />
          </div>
        </CapabilitySection>

        {/* §15 Sensitivity / firewall */}
        <CapabilitySection
          id="cap-15"
          num={15}
          label="Sensitivity & anti-causal firewall"
          tier="firewall"
          gated={!showResults && !isWalkedFail}
          gateMessage="Sensitivity surfaces alongside results."
        >
          <div
            style={{
              padding: "16px",
              border: `1px solid var(--qgi-border)`,
              borderLeft: `3px solid ${CALM_SLATE_BLUE}`,
              background: `rgba(91,126,153,0.06)`,
              borderRadius: "6px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                letterSpacing: "1.2px",
                color: CALM_SLATE_BLUE,
                fontFamily: "ui-monospace, monospace",
                marginBottom: "8px",
              }}
            >
              How to read this
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--qgi-text)",
                lineHeight: 1.6,
                margin: "0 0 10px",
              }}
            >
              Removing indicator{" "}
              <code style={{ fontFamily: "ui-monospace, monospace" }}>
                {mock.indicators[0]?.code}
              </code>{" "}
              degrades LOCO-AUC by 0.063. Removing all four collapses AUC to 0.554
              (chance).
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "var(--qgi-text-muted)",
                margin: 0,
                fontStyle: "italic",
              }}
            >
              Movement-shape signal is genuine, not an artefact of a single indicator. The
              recipe is not used to &ldquo;predict the past&rdquo; — see the methodology
              charter §M8-R5 for the train/test split spec.
            </p>
          </div>
        </CapabilitySection>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "1px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "20px",
          fontWeight: 600,
          color: emphasis ? "#3FBF8F" : "var(--qgi-text)",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatNode({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "1px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "20px",
          fontWeight: 600,
          color: "var(--qgi-text)",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "0.8px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "4px",
        }}
      >
        {k}
      </div>
      <div style={{ fontSize: "13px", color: "var(--qgi-text)", fontWeight: 500 }}>
        {v}
      </div>
    </div>
  );
}
