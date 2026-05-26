/**
 * /countries-v4/[iso] — per-country TE hub detail page.
 *
 * Per IA §1: this is the integration point for the per-country TE
 * capabilities — recipe scores + drivers + momentum + nearest-analog +
 * compound + sensitivity (anti-causal firewall) — cross-referenced into
 * /risk-board, /compound-risk, /nearest-analog, and /precedents-v2.
 *
 * Server component. `params` is Promise<{ iso }> per Next.js 16. The
 * 8 numbered sections mirror Precedents V4's CapabilitySection idiom.
 *
 * generateStaticParams pre-renders every country in the mock corpus.
 *
 * Mockup only. Local-only branch `local/te-precedents-mockup`.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Globe } from "lucide-react";
import {
  COUNTRIES_V4,
  getCountryByIso,
  type CountryV4,
} from "@/lib/te-mock/countries-v4-data";
import { vintageStamp } from "@/lib/te-mock/recipes";
import { CountryDetailHeader } from "@/components/countries-v4/CountryDetailHeader";
import { RecipeScoresTable } from "@/components/countries-v4/RecipeScoresTable";
import { DriversPanel } from "@/components/countries-v4/DriversPanel";
import { MomentumStrip } from "@/components/countries-v4/MomentumStrip";
import { AnalogsRow } from "@/components/countries-v4/AnalogsRow";

interface Params {
  params: Promise<{ iso: string }>;
}

export async function generateStaticParams() {
  return COUNTRIES_V4.map((c) => ({ iso: c.iso.toLowerCase() }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { iso } = await params;
  const country = getCountryByIso(iso);
  return {
    title: country
      ? `${country.name} (v4 mockup) · QG Intelligence`
      : "Country not found · QG Intelligence",
    description: country
      ? `Per-country TE hub for ${country.name}: scores + drivers + momentum + nearest analogs. Mockup only.`
      : "Country not found.",
    robots: { index: false, follow: false },
  };
}

export default async function CountryV4DetailPage({ params }: Params) {
  const { iso } = await params;
  const country: CountryV4 | undefined = getCountryByIso(iso);
  if (!country) notFound();

  const vintage = vintageStamp();

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      {/* Header strip — flag, name, compound chip, recipes-lit count, ISO */}
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
              gap: "12px",
              flexWrap: "wrap",
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
                href={"/countries-v4" as Route}
                style={{ color: "var(--qgi-text-muted)", textDecoration: "none" }}
              >
                ← Countries
              </Link>
              <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
              <span style={{ color: "var(--qgi-text-muted)" }}>{country.region}</span>
              <span style={{ margin: "0 8px", opacity: 0.5 }}>/</span>
              <span>{country.iso}</span>
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
              MOCKUP · /countries-v4/{country.iso.toLowerCase()}
            </span>
          </div>

          {/* Hero strip */}
          <CountryDetailHeader country={country} />
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "0 24px 64px" }}>
        {/* §1 Identity */}
        <Section num={1} label="Identity" tier="anatomy">
          <div
            style={{
              padding: "18px",
              border: "1px solid var(--qgi-border)",
              background: "var(--qgi-surface)",
              borderRadius: "8px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "16px",
            }}
          >
            <Field k="Region" v={country.region} />
            <Field k="Population" v={fmtPop(country.population)} />
            <Field
              k="Compound score"
              v={country.compound_score.toFixed(1)}
              accent="#f59e0b"
            />
            <Field k="Recipes lit" v={`${country.recipes_lit_count}`} />
            <Field
              k="of which graduated"
              v={`${country.recipes_lit_graduated}`}
              accent={country.recipes_lit_graduated > 0 ? "#3FBF8F" : undefined}
            />
            <Field k="Vintage" v={country.vintage} />
          </div>
        </Section>

        {/* §2 Recipe scores — table */}
        <Section num={2} label="Recipe scores" tier="results">
          <p
            style={{
              fontSize: "13px",
              color: "var(--qgi-text-muted)",
              marginBottom: "12px",
              maxWidth: "640px",
              lineHeight: 1.55,
            }}
          >
            Top-15 recipes by score for {country.name}. Each row is a{" "}
            <strong>discrimination rank</strong> on a single recipe&apos;s canonical
            movement shape — not a probability. Click into the recipe for its report card.
          </p>
          <RecipeScoresTable rows={country.top_recipes.slice(0, 15)} />
        </Section>

        {/* §3 Drivers — split per R&D reply §Q4 (qgi-docs #169):
            §A SHAP attribution + §B observed indicator movement. The two
            sub-sections are visually + textually distinct on purpose —
            attribution explains WHY the model scores the country high;
            movement reports what's observably shifting in the raw panels.
            Never conflate. */}
        <Section num={3} label="Drivers — attribution and movement" tier="results">
          <p
            style={{
              fontSize: "13px",
              color: "var(--qgi-text-muted)",
              marginBottom: "16px",
              maxWidth: "720px",
              lineHeight: 1.55,
            }}
          >
            Two separate questions, two separate panels: (§A) which indicators contribute
            most of the model&apos;s signal for {country.name}&apos;s top-lit recipe, and
            (§B) which indicators are observably moving in the raw input panels. They are
            not the same thing — a quietly shifted indicator can carry large SHAP weight;
            a dramatically moving one can carry little. We show both to keep the substrate
            story honest.
          </p>
          <DriversPanel
            attribution={country.drivers_attribution}
            movement={country.drivers_movement}
          />
        </Section>

        {/* §4 Momentum — rank-shift sparklines */}
        <Section num={4} label="Momentum (12 quarters)" tier="results">
          <p
            style={{
              fontSize: "13px",
              color: "var(--qgi-text-muted)",
              marginBottom: "12px",
              maxWidth: "640px",
              lineHeight: 1.55,
            }}
          >
            Rank-shift over the last 12 quarters across {country.name}&apos;s top-lit
            recipes. Retrospective only — describes how the country has moved through the
            score distribution, not where it is going.
          </p>
          <MomentumStrip momentum={country.momentum} vintage={country.vintage} />
        </Section>

        {/* §5 Compound view */}
        <Section num={5} label="Compound view" tier="results">
          <div
            style={{
              padding: "16px 18px",
              border: "1px solid var(--qgi-border)",
              background: "var(--qgi-surface)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: "240px" }}>
              <div
                style={{
                  fontSize: "10px",
                  letterSpacing: "1px",
                  color: "var(--qgi-text-dim)",
                  fontFamily: "ui-monospace, monospace",
                  marginBottom: "6px",
                }}
              >
                COMPOUND READ-OFF
              </div>
              <div
                style={{ fontSize: "15px", color: "var(--qgi-text)", lineHeight: 1.5 }}
              >
                {country.name} is currently lit on{" "}
                <strong>{country.recipes_lit_count} recipes</strong> across{" "}
                <strong>
                  {country.lit_families.length} L1 famil
                  {country.lit_families.length === 1 ? "y" : "ies"}
                </strong>
                {country.recipes_lit_graduated > 0 ? (
                  <>
                    {" "}
                    — of which{" "}
                    <strong style={{ color: "#3FBF8F" }}>
                      {country.recipes_lit_graduated} graduated
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    {" "}
                    — <em>none graduated</em> in the current vintage; surface as
                    discrimination-rank stacking only.
                  </>
                )}
              </div>
              <div
                style={{
                  marginTop: "10px",
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap",
                }}
              >
                {country.lit_families.map((fam) => (
                  <span
                    key={fam.l1_id}
                    style={{
                      fontSize: "10px",
                      padding: "3px 8px",
                      borderRadius: "3px",
                      border: `1px solid ${fam.l1_color}`,
                      color: fam.l1_color,
                      fontFamily: "ui-monospace, monospace",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {fam.l1_id} · {fam.l1_label}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href={
                `/compound-risk?families=${country.lit_families.map((f) => f.l1_id).join(",")}` as Route
              }
              style={{
                textDecoration: "none",
                padding: "10px 14px",
                border: "1px solid var(--qgi-accent)",
                color: "var(--qgi-accent)",
                borderRadius: "6px",
                fontSize: "12px",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.3px",
                whiteSpace: "nowrap",
              }}
            >
              Open in Compound Risk →
            </Link>
          </div>
        </Section>

        {/* §6 Nearest analogs */}
        <Section num={6} label="Nearest historical analogs" tier="results">
          <p
            style={{
              fontSize: "13px",
              color: "var(--qgi-text-muted)",
              marginBottom: "12px",
              maxWidth: "640px",
              lineHeight: 1.55,
            }}
          >
            Top-3 historical pre-event trajectories that most resemble {country.name}
            &apos;s current shape. <strong>Similarity statements</strong>, not predictions
            — &ldquo;what happened next&rdquo; is historical fact about the analog, never
            a forecast about {country.name}.
          </p>
          <AnalogsRow analogs={country.analogs} subjectName={country.name} />
          <div style={{ marginTop: "12px" }}>
            <Link
              href={`/nearest-analog?iso=${country.iso}` as Route}
              style={{
                fontSize: "12px",
                color: "var(--qgi-accent)",
                textDecoration: "none",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.3px",
              }}
            >
              Open the full Nearest-Analog finder →
            </Link>
          </div>
        </Section>

        {/* §7 Anti-causal firewall */}
        <Section num={7} label="Anti-causal firewall (M8-R5)" tier="firewall">
          <div
            style={{
              padding: "16px",
              border: "1px solid #E64545",
              background: "rgba(230,69,69,0.06)",
              borderRadius: "6px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                letterSpacing: "1.2px",
                color: "#E64545",
                fontFamily: "ui-monospace, monospace",
                marginBottom: "8px",
              }}
            >
              ANTI-CAUSAL FIREWALL · BINDING
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--qgi-text)",
                lineHeight: 1.6,
                margin: "0 0 10px",
              }}
            >
              Every number on this page is a{" "}
              <strong>discrimination rank, not a probability</strong>. {country.name}{" "}
              scoring 80 on a recipe means it sits high in the distribution of countries
              whose movement shape resembles that recipe — not that an 80% chance of the
              event applies. Driver indicators show observed movement in input data; they
              are not causal claims. Nearest analogs show shape similarity, not predicted
              outcomes. The Trajectory Engine is licensed to say{" "}
              <em>&ldquo;resembles the pre-crisis shape&rdquo;</em> — never{" "}
              <em>&ldquo;will happen.&rdquo;</em>
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "var(--qgi-text-muted)",
                margin: 0,
                fontStyle: "italic",
              }}
            >
              No recipe is currently 🟢 Validated. The visible lights are walked-failed or
              queued; surface accordingly. See{" "}
              <Link
                href={"/methodology" as Route}
                style={{ color: "var(--qgi-accent)", textDecoration: "underline" }}
              >
                methodology
              </Link>{" "}
              for the full honesty regime.
            </p>
          </div>
        </Section>

        {/* §8 Vintage + provenance */}
        <Section num={8} label="Vintage + provenance" tier="anatomy">
          <div
            style={{
              padding: "18px",
              border: "1px solid var(--qgi-border)",
              background: "var(--qgi-surface)",
              borderRadius: "8px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "16px",
            }}
          >
            <Field k="Country vintage" v={country.vintage} />
            <Field k="Tracker vintage" v={vintage} />
            <Field k="Cohort" v="LOCO-6" />
            <Field k="Walk #" v="v4 (running)" />
            <Field k="Ratification" v="Majles (pending)" />
            <Field k="ISO code" v={country.iso} />
          </div>
          <p
            style={{
              marginTop: "12px",
              fontSize: "11px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.3px",
            }}
          >
            Re-walk cadence ≥ 4× / yr · scores re-bake on each vintage · M8-R5 binding on
            every surface.
          </p>
        </Section>

        {/* Related across QGI */}
        <section
          style={{
            marginTop: "40px",
            paddingTop: "24px",
            borderTop: "1px solid var(--qgi-border)",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.5px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "12px",
              textTransform: "uppercase",
            }}
          >
            Related across QGI
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxWidth: "560px",
            }}
          >
            <Link
              href={"/risk-board" as Route}
              style={{
                color: "var(--qgi-text-muted)",
                fontSize: "13px",
                textDecoration: "none",
              }}
            >
              See {country.name} on the Live Risk Board →
            </Link>
            <Link
              href={"/compound-risk" as Route}
              style={{
                color: "var(--qgi-text-muted)",
                fontSize: "13px",
                textDecoration: "none",
              }}
            >
              See {country.name} on the Compound Risk board →
            </Link>
            <Link
              href={`/nearest-analog?iso=${country.iso}` as Route}
              style={{
                color: "var(--qgi-text-muted)",
                fontSize: "13px",
                textDecoration: "none",
              }}
            >
              Open the full Nearest-Analog finder for {country.name} →
            </Link>
            <Link
              href={"/precedents-v2" as Route}
              style={{
                color: "var(--qgi-text-muted)",
                fontSize: "13px",
                textDecoration: "none",
              }}
            >
              Browse the precedent recipe catalog →
            </Link>
          </div>
        </section>

        {/* Footer persona signature */}
        <footer
          style={{
            marginTop: "32px",
            paddingTop: "16px",
            borderTop: "1px solid var(--qgi-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.3px",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <Globe size={13} strokeWidth={1.6} /> {country.name} · {country.iso} · vintage{" "}
            {country.vintage}
          </span>
          <span>
            Designed by Dr. Kwame Asante — Compound-Risk Political Economy · with Talia,
            Daniyar, Sofia consulted
          </span>
        </footer>
      </div>
    </div>
  );
}

// ─── Local helpers (page-scoped) ──────────────────────────────────────────

function Section({
  num,
  label,
  tier,
  children,
}: {
  num: number;
  label: string;
  tier: "anatomy" | "results" | "firewall";
  children: React.ReactNode;
}) {
  const tierColor =
    tier === "anatomy" ? "var(--qgi-accent)" : tier === "results" ? "#3FBF8F" : "#E64545";
  const tierLabel =
    tier === "anatomy" ? "Anatomy" : tier === "results" ? "Results" : "Firewall";
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
      {children}
    </section>
  );
}

function Field({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: "10px",
          letterSpacing: "0.8px",
          color: "var(--qgi-text-dim)",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "4px",
          textTransform: "uppercase",
        }}
      >
        {k}
      </div>
      <div
        style={{
          fontSize: "15px",
          color: accent ?? "var(--qgi-text)",
          fontWeight: 600,
          fontFamily: accent ? "ui-monospace, monospace" : undefined,
        }}
      >
        {v}
      </div>
    </div>
  );
}

function fmtPop(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}
