import { ImageResponse } from "next/og";
import { OgFrame, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/OgFrame";

export const runtime = "edge";
export const alt = "Recipe Tracker · QG Intelligence · Live status of all 71 recipes";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    <OgFrame
      eyebrow="Blog · Recipe Tracker"
      title="71 recipes. 1 graduated. 6 in validation."
      tagline="Live status board for every QGI recipe. Graduation requires clearing hard validation gates in held-out historical data, and most candidates will not."
      rightStat={{ value: "71", label: "Total Recipes" }}
    />,
    OG_SIZE
  );
}
