/**
 * FlagImg — flagcdn.com image flag, decoded straight from a flag emoji.
 *
 * Windows 10 has no Regional-Indicator glyphs, so emoji flags fall back to
 * bare letters ("SD"). We render an <img> from flagcdn instead, sized for
 * 2× sharpness. The alpha-2 code is decoded from the emoji itself
 * (lib/te-mock/flag-cdn) so there's no name→iso table to drift. On a decode
 * miss we render a sized placeholder so row/grid geometry never collapses.
 *
 * Plain <img> (not next/image): flagcdn is an external host and the tiles
 * are tiny; this matches the V4.1 flag treatment (CountriesPanel).
 */
import type { CSSProperties } from "react";
import { iso2FromFlagEmoji } from "@/lib/te-mock/flag-cdn";

// flagcdn width presets (the wNN series). We pick the smallest >= 2× the
// display width so Hi-DPI screens get a crisp raster without upscaling.
const W_PRESETS = [20, 40, 80, 160, 320, 640];
function cdnWidthFor(displayWidth: number): number {
  const target = displayWidth * 2;
  return W_PRESETS.find((w) => w >= target) ?? W_PRESETS[W_PRESETS.length - 1];
}

export function FlagImg({
  emoji,
  name,
  width = 24,
  radius = 2,
  style,
}: {
  emoji: string;
  name: string;
  /** Display width in px. Height is derived at a 4:3 ratio. */
  width?: number;
  radius?: number;
  style?: CSSProperties;
}) {
  const iso2 = iso2FromFlagEmoji(emoji);
  const height = Math.round(width * 0.75);

  if (!iso2) {
    return (
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width,
          height,
          borderRadius: radius,
          background: "var(--qgi-bg)",
          border: "1px solid var(--qgi-border)",
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w${cdnWidthFor(width)}/${iso2}.png`}
      alt={`${name} flag`}
      width={width}
      height={height}
      style={{
        display: "block",
        objectFit: "cover",
        borderRadius: radius,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
