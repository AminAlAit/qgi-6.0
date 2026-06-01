/**
 * FeaturedPatternsPanel — Dashboard panel showing 4 featured cascade pair
 * patterns from data/cascade-patterns-featured.json.
 *
 * Sits below the Highlights rail in the dashboard main column.
 * Cascade-era only; no TE / Analogues mixing.
 *
 * V4.1 chrome: flag images, PPS score with color lerp, tier badge, calm-slate
 * left-border accent. Single h2 header, one-line description.
 *
 * 2026-05-30
 */

import Link from "next/link";
import type { Route } from "next";
import { PanelBase } from "./PanelBase";
import { FlagImg } from "@/components/countries-v4-1/FlagImg";
import { flagFor } from "@/lib/te-mock/country-flags";
import { MUTED_GRAY, confidenceT, lerpHexToRgb, confidenceGlow } from "@/lib/color-lerp";
import { TierBadge } from "@/components/patterns-v4/PatternsSearch";
import type { FeaturedPair } from "@/lib/cascade-patterns/patterns-data";

const ACCENT = "#5B7E99"; // CALM_SLATE_BLUE

interface Props {
  pairs: FeaturedPair[];
  /** Max number to show. Default 4. */
  limit?: number;
}

export function FeaturedPatternsPanel({ pairs, limit = 4 }: Props) {
  const displayed = pairs.slice(0, limit);
  if (!displayed.length) return null;

  return (
    <PanelBase
      title="Featured pair patterns"
      caption="Country pairs whose long-run indicator paths ran in close parallel."
      accent={ACCENT}
      rightSlot={
        <Link
          href={"/patterns" as Route}
          style={{
            fontSize: "10.5px",
            letterSpacing: "0.4px",
            color: ACCENT,
            fontFamily: "ui-monospace, monospace",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          View all patterns →
        </Link>
      }
    >
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {displayed.map((pair) => (
          <PairPatternRow key={pair.slug} pair={pair} />
        ))}
      </ol>
    </PanelBase>
  );
}

function PairPatternRow({ pair }: { pair: FeaturedPair }) {
  const ppsDisplay = pair.pps ? Math.round(pair.pps) : null;
  const ppsT = ppsDisplay ? Math.min(1, ppsDisplay / 2000) : 0;
  const corrVal = pair.best_corr ?? pair.corr ?? 0;

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

  const emojiA = buildEmoji(pair.country_a_a2);
  const emojiB = buildEmoji(pair.country_b_a2);

  return (
    <li>
      <Link
        href={`/patterns/${pair.slug}` as Route}
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "8px 10px",
            background: "var(--qgi-bg)",
            border: "1px solid var(--qgi-border)",
            borderLeft: `2px solid ${ACCENT}`,
            borderRadius: "4px",
          }}
        >
          {/* Row 1: Country pair + PPS */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                flexWrap: "wrap",
                flex: 1,
                minWidth: 0,
              }}
            >
              {/* Country A */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--qgi-text)",
                  whiteSpace: "nowrap",
                }}
              >
                <FlagImg
                  emoji={emojiA || flagFor(pair.country_a)}
                  name={pair.country_a}
                  width={13}
                  radius={2}
                />
                {pair.country_a}
              </span>

              <span
                style={{
                  fontSize: "10px",
                  color: "var(--qgi-text-dim)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                +
              </span>

              {/* Country B */}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--qgi-text)",
                  whiteSpace: "nowrap",
                }}
              >
                <FlagImg
                  emoji={emojiB || flagFor(pair.country_b)}
                  name={pair.country_b}
                  width={13}
                  radius={2}
                />
                {pair.country_b}
              </span>
            </div>

            {/* PPS */}
            {ppsDisplay !== null && (
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "-0.3px",
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

          {/* Row 2: tier + window length + corr */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              paddingLeft: "2px",
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
                  color: lerpHexToRgb(MUTED_GRAY, "#b0cfb8", confidenceT(corrVal * 100)),
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                r = {corrVal.toFixed(3)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

function buildEmoji(a2?: string): string {
  if (!a2 || a2.length !== 2) return "";
  return String.fromCodePoint(
    ...a2
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}
