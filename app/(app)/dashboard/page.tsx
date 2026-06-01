/**
 * Briefing (formerly "Dashboard") — the front door.
 *
 * 2026-05-31 re-center (founder): lead with "how countries are following
 * recipes," not catalogue trivia. The big count tiles, coverage map, signal-
 * source plot and 20-pair rail are gone from center stage; the page now opens
 * with the live "Closest matches right now" row (the 95%er band, one story per
 * country, each → the country×recipe match page), then Historical resemblances
 * (→ Analogues), then what's moving this vintage. Catalogue scope is demoted to
 * a slim strip near the foot and to /methodology. Confidence-first throughout.
 *
 * All real fleet-run-1 data. Route stays /dashboard; the nav label + title now
 * read "Briefing".
 */
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { getAllRecipes } from "@/lib/te-mock/recipes";
import {
  buildHeroCountsV41,
  buildFamilyDistribution,
  buildClosestMatches,
  buildTopPairTeasers,
  buildWorldActivityRows,
  type CountryPairTeaser,
} from "@/lib/te-mock/dashboard-v4-1-data";
import { ClosestMatches } from "@/components/dashboard-v4-1/ClosestMatches";
import { WorldActivity } from "@/components/dashboard-v4-1/WorldActivity";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { flagFor } from "@/lib/te-mock/country-flags";

export const metadata: Metadata = {
  title: "Briefing · QG Intelligence",
  description:
    "Which countries are tracing the shapes that came before the events that matter, right now, across 180+ countries and territories.",
};

export default function BriefingPage() {
  const recipes = getAllRecipes();
  const counts = buildHeroCountsV41(recipes);
  const familyCount = buildFamilyDistribution().length;
  const matches = buildClosestMatches(8);
  // The analogue match metric saturates (most pairs read >=99%), so we show
  // the "95%er" band (90-98.5) and spread 6 across it for variety, rather than
  // a wall of 99/100s.
  const resemblanceBand = buildTopPairTeasers(2000).filter(
    (p) => p.match_pct >= 90 && p.match_pct < 98.5
  );
  const resemblances =
    resemblanceBand.length <= 6
      ? resemblanceBand
      : Array.from(
          { length: 6 },
          (_, i) => resemblanceBand[Math.round((i * (resemblanceBand.length - 1)) / 5)]
        );
  const activity = buildWorldActivityRows();

  return (
    <div
      style={{ minHeight: "100%", background: "var(--qgi-bg)", color: "var(--qgi-text)" }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "20px 24px 64px" }}>
        {/* Hero */}
        <section style={{ marginBottom: "28px" }}>
          <div
            style={{
              color: "var(--qgi-accent)",
              fontSize: "10px",
              letterSpacing: "4px",
              textTransform: "uppercase",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "10px",
            }}
          >
            Briefing
          </div>
          <h1
            style={{
              fontSize: "38px",
              fontWeight: 600,
              lineHeight: 1.1,
              margin: "0 0 12px",
              maxWidth: "820px",
              letterSpacing: "-0.5px",
            }}
          >
            Country risk, read against history.
          </h1>
          <p
            style={{
              color: "var(--qgi-text-muted)",
              fontSize: "15px",
              lineHeight: 1.6,
              margin: 0,
              maxWidth: "760px",
            }}
          >
            Across 180+ countries and territories, every country is scored against the
            shapes that preceded the events that matter, and shown alongside the
            historical cases it most resembles. Here is what stands out right now.
          </p>
        </section>

        {/* Centerpiece: closest matches */}
        <ClosestMatches matches={matches} />

        {/* Historical resemblances → Analogues */}
        <ResemblanceHighlights pairs={resemblances} />

        {/* What's moving this vintage */}
        <section data-tour="world-activity" style={{ marginTop: "32px" }}>
          <WorldActivity rows={activity} />
        </section>

        {/* Demoted scope strip */}
        <section style={{ marginTop: "36px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px 22px",
              flexWrap: "wrap",
              padding: "14px 18px",
              border: "1px solid var(--qgi-border)",
              borderRadius: "8px",
              background: "var(--qgi-surface)",
              fontFamily: "ui-monospace, monospace",
              fontSize: "12px",
              color: "var(--qgi-text-muted)",
            }}
          >
            <ScopeStat value="180+" label="countries & territories" />
            <ScopeDivider />
            <ScopeStat value={String(counts.recipes_total)} label="event recipes" />
            <ScopeDivider />
            <ScopeStat value={String(familyCount)} label="risk families" />
            <ScopeDivider />
            <ScopeStat
              value={String(counts.indicators_tracked)}
              label="signals tracked"
            />
            <ScopeDivider />
            <ScopeStat value="quarterly" label="refresh cadence" />
            <span style={{ flex: 1 }} />
            <Link
              href={"/methodology" as Route}
              style={{
                color: "var(--qgi-accent)",
                textDecoration: "none",
                letterSpacing: "0.3px",
                whiteSpace: "nowrap",
              }}
            >
              See how it works &rarr;
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function ScopeStat({ value, label }: { value: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: "6px" }}>
      <span
        style={{ color: "var(--qgi-text)", fontWeight: 700, letterSpacing: "-0.3px" }}
      >
        {value}
      </span>
      <span style={{ color: "var(--qgi-text-dim)" }}>{label}</span>
    </span>
  );
}

function ScopeDivider() {
  return (
    <span aria-hidden style={{ color: "var(--qgi-border)" }}>
      ·
    </span>
  );
}

/* ── Historical resemblances row ── */
function ResemblanceHighlights({ pairs }: { pairs: CountryPairTeaser[] }) {
  if (pairs.length === 0) return null;
  return (
    <section data-tour="historical-resemblances" style={{ marginTop: "36px" }}>
      <style>{`
        .qgi-res-card { transition: transform 140ms ease, box-shadow 140ms ease; }
        .qgi-res-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
      `}</style>
      <header style={{ marginBottom: "14px" }}>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 600,
            margin: "0 0 4px",
            letterSpacing: "-0.2px",
          }}
        >
          Historical resemblances
        </h2>
        <p
          style={{
            fontSize: "13.5px",
            color: "var(--qgi-text-muted)",
            margin: 0,
            lineHeight: 1.5,
            maxWidth: "760px",
          }}
        >
          Where a country today most resembles a real situation from the past. Similarity
          is not prediction; it is a lens on history. Open any to explore the full set of
          analogues.
        </p>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "14px",
        }}
      >
        {pairs.map((p) => (
          <Link
            key={`${p.country_a}-${p.country_b}-${p.country_b_year}-${p.recipe_id}`}
            href={"/analogues" as Route}
            className="qgi-res-card"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              textDecoration: "none",
              color: "inherit",
              background: "var(--qgi-surface)",
              border: "1px solid var(--qgi-border)",
              borderLeft: "3px solid #B6924A",
              borderRadius: "8px",
              padding: "14px",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  minWidth: 0,
                }}
              >
                <FlagImg
                  emoji={flagFor(p.country_a)}
                  name={p.country_a}
                  width={18}
                  radius={2}
                />
                <span
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: "var(--qgi-text)",
                  }}
                >
                  {p.country_a}
                </span>
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--qgi-text-dim)",
                  fontStyle: "italic",
                }}
              >
                resembles
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  minWidth: 0,
                }}
              >
                <FlagImg
                  emoji={flagFor(p.country_b)}
                  name={p.country_b}
                  width={18}
                  radius={2}
                />
                <span
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: "var(--qgi-text)",
                  }}
                >
                  {p.country_b}, {p.country_b_year}
                </span>
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "12px", color: "var(--qgi-text-muted)" }}>
                {p.recipe_label}
              </span>
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#C9A84C",
                }}
              >
                {Math.round(p.match_pct)}% match
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
