/**
 * CountriesV41Hero — headline + lede + 4 stat tiles for /countries-v4.1.
 *
 * Color (Talia consult 2026-05-28): the stat tiles are summary numbers, not
 * threat families, so they must NOT borrow family hues — that would imply a
 * family meaning that isn't there. All four are neutral navy with a slate
 * accent. The single exception is "Country of the week", whose top border
 * uses that country's dominant-family color, because it points at a real
 * country whose threat kind is a true fact.
 *
 * Honesty: the lede states the ranks-not-probabilities frame and the "none
 * deployed yet" truth in plain language, replacing the old branded
 * "HONESTY-REGIME DISCLOSURE · M8-R5" box.
 */
import Link from "next/link";
import type { Route } from "next";
import { Globe, Flame, Layers, Award, type LucideIcon } from "lucide-react";
import { FlagImg } from "./FlagImg";
import { familyColor, NEUTRAL_SLATE } from "@/lib/te-mock/l1-families";
import type { CountryV4 } from "@/lib/te-mock/countries-v4-data";

function HeroTile({
  children,
  accent,
  Icon,
  href,
}: {
  children: React.ReactNode;
  accent: string;
  Icon: LucideIcon;
  href?: Route;
}) {
  const inner = (
    <div
      style={{
        background: "var(--qgi-surface)",
        border: "1px solid var(--qgi-border)",
        borderTop: `3px solid ${accent}`,
        borderRadius: "8px",
        padding: "16px 18px",
        display: "flex",
        alignItems: "flex-start",
        gap: "14px",
        minHeight: "96px",
        height: "100%",
        cursor: href ? "pointer" : "default",
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--qgi-bg)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "6px",
          color: accent,
        }}
      >
        <Icon size={20} strokeWidth={1.6} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

function StatBody({
  count,
  label,
  sublabel,
}: {
  count: string;
  label: string;
  sublabel: string;
}) {
  return (
    <>
      <div
        style={{
          fontFamily: "ui-monospace, monospace",
          fontWeight: 600,
          fontSize: "28px",
          lineHeight: 1.05,
          color: "var(--qgi-text)",
          letterSpacing: "-0.5px",
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
    </>
  );
}

export function CountriesV41Hero({
  total,
  litAny,
  compoundHigh,
  countryOfTheWeek,
  vintage,
}: {
  total: number;
  litAny: number;
  compoundHigh: number;
  countryOfTheWeek: CountryV4;
  vintage: string;
}) {
  const cotwTop = countryOfTheWeek.top_recipes[0];
  const cotwAccent = cotwTop
    ? familyColor(cotwTop.l1_id, cotwTop.l1_color)
    : NEUTRAL_SLATE;

  return (
    <header style={{ marginBottom: "8px" }}>
      <div
        style={{
          color: "var(--qgi-text-dim)",
          fontSize: "10px",
          letterSpacing: "4px",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, monospace",
          marginBottom: "8px",
        }}
      >
        Country Atlas
      </div>
      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div style={{ maxWidth: "860px" }}>
          <h1
            style={{
              fontSize: "34px",
              fontWeight: 600,
              lineHeight: 1.1,
              margin: "0 0 10px",
            }}
          >
            What does QGI say about this country, right now?
          </h1>
          <p
            style={{
              color: "var(--qgi-text-muted)",
              fontSize: "14px",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Every country we track, with the recipes its recent signals resemble, the
            indicators behind each score, how it has moved, and its closest historical
            analogs. Scores rank how strongly a country resembles past pre-event
            conditions. They are a measure of resemblance, not the chance an event will
            happen, and none of these recipes is yet deployed for real decisions. Open any
            card for the full country view.
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
          Vintage {vintage}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
        }}
      >
        <HeroTile accent={NEUTRAL_SLATE} Icon={Globe}>
          <StatBody
            count={String(total)}
            label="Countries tracked"
            sublabel="In the current corpus"
          />
        </HeroTile>
        <HeroTile accent={NEUTRAL_SLATE} Icon={Flame}>
          <StatBody
            count={String(litAny)}
            label="Lit on ≥1 recipe"
            sublabel="Signals resemble at least one pattern"
          />
        </HeroTile>
        <HeroTile accent={NEUTRAL_SLATE} Icon={Layers}>
          <StatBody
            count={String(compoundHigh)}
            label="3+ recipes lit"
            sublabel="Multiple patterns at once"
          />
        </HeroTile>
        <HeroTile
          accent={cotwAccent}
          Icon={Award}
          href={`/countries-v4.1/${countryOfTheWeek.iso.toLowerCase()}` as Route}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
            }}
          >
            <FlagImg
              emoji={countryOfTheWeek.flag_emoji}
              name={countryOfTheWeek.name}
              width={28}
              radius={3}
            />
            <span
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "var(--qgi-text)",
                lineHeight: 1,
              }}
            >
              {countryOfTheWeek.name}
            </span>
          </div>
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              fontFamily: "ui-monospace, monospace",
              color: "var(--qgi-text)",
              fontWeight: 600,
            }}
          >
            Country of the week
          </div>
          <div
            style={{ fontSize: "11px", color: "var(--qgi-text-muted)", marginTop: "2px" }}
          >
            Compound {countryOfTheWeek.compound_score.toFixed(0)} ·{" "}
            {countryOfTheWeek.recipes_lit_count} lit
          </div>
        </HeroTile>
      </div>
    </header>
  );
}
