import { ImageResponse } from "next/og";
import { OgFrame, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/OgFrame";

export const runtime = "edge";
export const alt = "Methodology · QG Intelligence · How QGI finds geopolitical risk";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    <OgFrame
      eyebrow="Methodology"
      title="How QGI finds geopolitical risk."
      tagline="Recipes, validation gates, calibration error, LOCO cross-validation. The full evidence chain behind every QG Intelligence assessment."
    />,
    OG_SIZE
  );
}
