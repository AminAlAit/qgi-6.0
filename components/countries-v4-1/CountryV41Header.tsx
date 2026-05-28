/**
 * CountryV41Header — header strip for /countries-v4.1/[iso].
 *
 * Neutral page chrome (Talia): a country is not one family, so the header
 * does not flood with a single hue. The flag tile carries a thin
 * dominant-family border; family identity lives in the chip row (each chip
 * = letter glyph + label), with the dominant family emphasized. The lede
 * states the honest frame (resemblance not forecast; none deployed) in
 * plain language.
 */
import { FlagImg } from "./FlagImg";
import { FamilyChip } from "./FamilyChip";
import { NEUTRAL_SLATE } from "@/lib/te-mock/l1-families";
import { familiesByBestScore } from "@/lib/te-mock/country-families";
import type { CountryV4 } from "@/lib/te-mock/countries-v4-data";

function fmtPop(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function CountryV41Header({ country }: { country: CountryV4 }) {
  const fams = familiesByBestScore(country);
  const dominant = fams[0];
  const accent = dominant?.color ?? NEUTRAL_SLATE;
  const famCount = fams.length;

  const lede =
    `${country.name} is currently lit on ${country.recipes_lit_count} of our risk ` +
    `recipes across ${famCount} famil${famCount === 1 ? "y" : "ies"}. The scores below ` +
    `rank how closely ${country.name}'s recent signals resemble the conditions that ` +
    `preceded similar events elsewhere. They are a measure of resemblance, not a ` +
    `forecast, and none of these recipes is yet deployed for decisions.`;

  return (
    <div
      style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}
    >
      <div
        style={{
          width: "88px",
          height: "88px",
          background: "var(--qgi-bg)",
          border: `1px solid ${accent}`,
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <FlagImg emoji={country.flag_emoji} name={country.name} width={64} radius={4} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Status chip — program-wide truth, quiet not alarming */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "10px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              padding: "3px 9px",
              border: "1px solid var(--qgi-border)",
              color: "var(--qgi-text-muted)",
              background: "rgba(122,143,160,0.10)",
              borderRadius: "4px",
              letterSpacing: "0.3px",
              fontFamily: "ui-monospace, monospace",
            }}
            title="No recipe is yet deployed for real decisions. Every light is a flag for attention, not a confirmed prediction."
          >
            Not deployed
          </span>
          <span
            style={{
              fontSize: "11px",
              padding: "3px 9px",
              border: "1px solid var(--qgi-border)",
              color: "var(--qgi-text)",
              borderRadius: "4px",
              letterSpacing: "0.3px",
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
            }}
            title="A relative stacking of high rankings across this country's lit recipes, not a probability."
          >
            Compound Risk {country.compound_score.toFixed(0)}
          </span>
        </div>

        <h1
          style={{
            fontSize: "30px",
            fontWeight: 600,
            lineHeight: 1.15,
            margin: "0 0 6px",
          }}
        >
          {country.name}
        </h1>
        <p
          style={{
            color: "var(--qgi-text-muted)",
            fontSize: "13px",
            margin: "0 0 14px",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.3px",
          }}
        >
          {country.iso} · {country.region} · pop. {fmtPop(country.population)} · vintage{" "}
          {country.vintage}
        </p>

        <p
          style={{
            maxWidth: "720px",
            fontSize: "15px",
            lineHeight: 1.65,
            color: "var(--qgi-text)",
            margin: "0 0 14px",
          }}
        >
          {lede}
        </p>

        {/* Family chip row — dominant emphasized */}
        {fams.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {fams.map((f, i) => (
              <FamilyChip
                key={f.id}
                id={f.id}
                label={f.label}
                color={f.color}
                emphasis={i === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
