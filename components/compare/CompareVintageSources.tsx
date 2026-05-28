/**
 * CompareVintageSources -- provenance footer for /compare.
 *
 * Standard shape matching VintageSourcesPanel on country-detail.
 * Shows vintage + refresh cadence + data sources + a honest "not deployed" line.
 *
 * V4.1 bar: NEUTRAL_SLATE accent, no em-dashes, no banned vocab.
 */
import { PanelShell } from "@/components/countries-v4-1/PanelShell";
import { NEUTRAL_SLATE } from "@/lib/te-mock/l1-families";
import type { CountryV4 } from "@/lib/te-mock/countries-v4-data";

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
          textTransform: "uppercase",
        }}
      >
        {k}
      </div>
      <div style={{ fontSize: "13px", color: "var(--qgi-text)", fontWeight: 600 }}>
        {v}
      </div>
    </div>
  );
}

export function CompareVintageSources({
  countryA,
  countryB,
}: {
  countryA: CountryV4;
  countryB: CountryV4;
}) {
  // Union of providers from both countries' movement drivers.
  const sources = Array.from(
    new Set([
      ...countryA.drivers_movement.map((d) => d.provider),
      ...countryB.drivers_movement.map((d) => d.provider),
    ])
  ).sort();

  const vintage =
    countryA.vintage === countryB.vintage
      ? countryA.vintage
      : `${countryA.vintage} / ${countryB.vintage}`;

  return (
    <PanelShell
      title="Vintage and sources"
      accent={NEUTRAL_SLATE}
      fullWidth
      dataTour="compare-vintage"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "16px",
          marginBottom: "14px",
        }}
      >
        <Field k="Vintage" v={vintage} />
        <Field k="Refresh cadence" v="At least 4x per year" />
        <Field k="Data sources" v={sources.join(" / ") || "n/a"} />
        <Field
          k="Recipes in play"
          v={`${countryA.name}: ${countryA.recipes_lit_count} | ${countryB.name}: ${countryB.recipes_lit_count}`}
        />
      </div>
      <p
        style={{
          fontSize: "12px",
          lineHeight: 1.55,
          color: "var(--qgi-text-muted)",
          margin: 0,
          maxWidth: "72ch",
        }}
      >
        These scores are reported for research review. None of the recipes shown has yet
        met our bar to be deployed for real decisions. Every score is a resemblance rank,
        not a probability.
      </p>
    </PanelShell>
  );
}
