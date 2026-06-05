import { ImageResponse } from "next/og";
import { OgFrame, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/OgFrame";

export const runtime = "edge";
export const alt = "Trend Tracker · QG Intelligence · Live status of all 71 trends";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    <OgFrame
      eyebrow="Blog · Trend Tracker"
      title="71 trends. 9 in play. The rest must earn it."
      tagline="Live status board for every QGI trend. A trend only drives country scores after clearing validation gates in held-out historical data, and most will not on a given walk."
      rightStat={{ value: "9", label: "Trends in play" }}
    />,
    OG_SIZE
  );
}
