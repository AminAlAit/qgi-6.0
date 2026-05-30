/**
 * FeaturedPairsStrip — 12-card grid of Selene-curated featured pair patterns.
 *
 * Server component (no interactivity needed). Cards link to /patterns/[slug].
 * Flag images via FlagImg (flagcdn.com, V4.1 convention).
 * PPS color lerp via confidenceGlow (soft variant, CALM_SLATE_BLUE family).
 *
 * V4.1 §0 confidence-first: no methodology jargon, no hedge text.
 * No em-dashes. Flag emojis everywhere. Tier badge + PPS + correlation.
 *
 * 2026-05-30
 */

import Link from "next/link";
import type { Route } from "next";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { flagFor } from "@/lib/te-mock/country-flags";
import { MUTED_GRAY, confidenceT, lerpHexToRgb, confidenceGlow } from "@/lib/color-lerp";
import { TierBadge } from "./PatternsSearch";
import type { FeaturedPair } from "@/lib/cascade-patterns/patterns-data";

const ACCENT = "#5B7E99"; // CALM_SLATE_BLUE

interface Props {
  pairs: FeaturedPair[];
}

export function FeaturedPairsStrip({ pairs }: Props) {
  if (!pairs.length) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "12px",
      }}
    >
      {pairs.map((pair) => (
        <FeaturedCard key={pair.slug} pair={pair} />
      ))}
    </div>
  );
}

function FeaturedCard({ pair }: { pair: FeaturedPair }) {
  const ppsDisplay = pair.pps ? Math.round(pair.pps) : null;
  const ppsT = ppsDisplay ? Math.min(1, ppsDisplay / 2000) : 0;
  const corrVal = pair.best_corr ?? pair.corr ?? 0;
  const corrT = confidenceT(corrVal * 100);

  const ppsColor = ppsDisplay ? lerpHexToRgb(MUTED_GRAY, ACCENT, ppsT) : MUTED_GRAY;
  const ppsGlow = ppsDisplay ? confidenceGlow(ACCENT, ppsT) : "";

  const tier =
    ppsDisplay !== null
      ? ppsDisplay >= 2000
        ? "XL"
        : ppsDisplay >= 1000
          ? "L"
          : ppsDisplay >= 200
            ? "M"
            : "S"
      : "S";

  return (
    <Link
      href={`/patterns/${pair.slug}` as Route}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
        height: "100%",
      }}
    >
      <div
        style={{
          height: "100%",
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderTop: `2px solid ${ACCENT}`,
          borderRadius: "6px",
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          transition: "border-color 120ms",
        }}
      >
        {/* Country pair header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <CountryChip name={pair.country_a} a2={pair.country_a_a2} />
          <span
            style={{
              fontSize: "10px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            +
          </span>
          <CountryChip name={pair.country_b} a2={pair.country_b_a2} />
        </div>

        {/* Note */}
        <p
          style={{
            fontSize: "12px",
            lineHeight: 1.55,
            color: "var(--qgi-text-muted)",
            margin: 0,
            flex: 1,
          }}
        >
          {pair.note}
        </p>

        {/* Footer: window stats + PPS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            borderTop: "1px solid var(--qgi-border)",
            paddingTop: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <TierBadge tier={tier} />
            {pair.best_length ? (
              <span
                style={{
                  fontSize: "10.5px",
                  color: "var(--qgi-text-dim)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {pair.best_length}y
              </span>
            ) : null}
            {corrVal > 0 ? (
              <span
                style={{
                  fontSize: "10.5px",
                  color: lerpHexToRgb(MUTED_GRAY, "#b0cfb8", corrT),
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                r = {corrVal.toFixed(3)}
              </span>
            ) : null}
          </div>

          {ppsDisplay !== null && (
            <span
              style={{
                fontSize: "16px",
                fontWeight: 700,
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "-0.5px",
                color: ppsColor,
                textShadow: ppsGlow || undefined,
                flexShrink: 0,
              }}
              title={`Pattern Power Score: ${ppsDisplay}`}
            >
              {ppsDisplay}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function CountryChip({ name, a2 }: { name: string; a2?: string }) {
  // Build a synthetic emoji from the a2 code for flagFor fallback
  const emojiFromA2 = a2
    ? String.fromCodePoint(
        ...a2
          .toUpperCase()
          .split("")
          .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
      )
    : "";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "13px",
        fontWeight: 700,
        color: "var(--qgi-text)",
        whiteSpace: "nowrap",
      }}
    >
      <FlagImg
        emoji={emojiFromA2 || flagFor(name)}
        name={name}
        width={15}
        radius={2}
        style={{ flexShrink: 0 }}
      />
      {name}
    </span>
  );
}
