import type { RecipeStatus } from "@/lib/te-mock/recipes";

export const STATUS_META: Record<
  RecipeStatus,
  { label: string; color: string; bgAlpha: string }
> = {
  graduated: { label: "Validated", color: "#3FBF8F", bgAlpha: "rgba(63,191,143,0.15)" },
  walked_no_graduation: {
    label: "Walked, not graduated",
    color: "#E68F29",
    bgAlpha: "rgba(230,143,41,0.15)",
  },
  in_progress: {
    label: "Walk in progress",
    color: "#a78bfa",
    bgAlpha: "rgba(167,139,250,0.15)",
  },
  // 2026-05-29 wire-up: relabel from "Legacy ML-1" → "Prior vintage" to
  // strip the methodology-jargon from user-facing chips.
  live_legacy: {
    label: "Prior vintage",
    color: "#7A8FA0",
    bgAlpha: "rgba(122,143,160,0.15)",
  },
  queued: { label: "Queued", color: "#64748b", bgAlpha: "rgba(100,116,139,0.15)" },
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
