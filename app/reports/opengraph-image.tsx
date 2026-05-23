import { ImageResponse } from "next/og";
import { OgFrame, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/OgFrame";

export const runtime = "edge";
export const alt = "Intelligence Reports · QG Intelligence";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    <OgFrame
      eyebrow="Intelligence Reports"
      title="Pattern-driven analysis of sovereign risk."
      tagline="Country analogues, structural divergence, sovereign credit theses, all generated from live pipeline data and fully reproducible by design."
    />,
    OG_SIZE
  );
}
