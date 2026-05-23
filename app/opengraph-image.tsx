import { ImageResponse } from "next/og";
import { OgFrame, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/OgFrame";
import { TOTAL_COUNTRIES, TOTAL_INDICATORS } from "@/lib/site-stats";

export const runtime = "edge";
export const alt =
  "QG Intelligence · Quantitative Geopolitical Intelligence · Pattern Recurrence Intelligence";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    <OgFrame
      eyebrow="Quantitative Geopolitical Intelligence"
      title="Historical precedents, not forecasts."
      tagline={`Structural fingerprints across ${TOTAL_COUNTRIES} countries and ${TOTAL_INDICATORS} indicators, sourced from Open Source Intelligence.`}
    />,
    OG_SIZE
  );
}
