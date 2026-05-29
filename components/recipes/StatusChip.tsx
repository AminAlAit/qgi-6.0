import type { RecipeStatus } from "@/lib/te-mock/recipes";

/** STATUS_META — V4.1 §4 vocabulary applied 2026-05-29.
 *  All banned chip text ("Walked, not graduated", "Walk in progress",
 *  "Prior vintage", "Queued") replaced with the audience-facing
 *  vocabulary: Validated / In play / Coming soon / Prior version.
 *
 *  "Coming soon" reads as "on the roadmap, just not shipped yet".
 *  "In play" reads as "we are actively using and refining this".
 *  Both are honest; neither leaks methodology jargon. */
export const STATUS_META: Record<
  RecipeStatus,
  { label: string; color: string; bgAlpha: string }
> = {
  graduated: { label: "Validated", color: "#3FBF8F", bgAlpha: "rgba(63,191,143,0.15)" },
  walked_no_graduation: {
    label: "In play",
    color: "#5B7E99",
    bgAlpha: "rgba(91,126,153,0.15)",
  },
  in_progress: {
    label: "In play",
    color: "#5B7E99",
    bgAlpha: "rgba(91,126,153,0.15)",
  },
  live_legacy: {
    label: "Prior version",
    color: "#7A8FA0",
    bgAlpha: "rgba(122,143,160,0.15)",
  },
  queued: { label: "Coming soon", color: "#7A8FA0", bgAlpha: "rgba(122,143,160,0.15)" },
};

export function StatusChip({
  status,
  size = "sm",
}: {
  status: RecipeStatus;
  size?: "sm" | "md";
}) {
  const meta = STATUS_META[status];
  const padding = size === "sm" ? "3px 9px" : "5px 12px";
  const fontSize = size === "sm" ? "11px" : "12px";
  return (
    <span
      style={{
        padding,
        fontSize,
        border: `1px solid ${meta.color}`,
        color: meta.color,
        backgroundColor: meta.bgAlpha,
        borderRadius: "4px",
        letterSpacing: "0.3px",
        fontFamily: "ui-monospace, monospace",
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}
