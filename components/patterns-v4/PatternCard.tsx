/**
 * PatternCard — one canonical-movement-shape entry in the /patterns-v4
 * gallery. Compact tile with:
 *   - L1 family chip (top-right) + lifecycle status pill
 *   - Recipe icon + name + sub-class
 *   - The 12-point shape sparkline preview
 *   - Window-length + n_positives metric chips
 *   - Avg match score (mean of top-10 current matches)
 *   - "Open →" affordance
 *
 * Cards link to /patterns-v4/[id] for the per-pattern detail page.
 *
 * Server component. Match the RecipeCard idiom from precedents-v2: same
 * surface tokens, monospace metric chips, line-art icon, tier ribbon.
 */
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { RecipeIcon } from "@/components/te-v4-shared/RecipeIcon";
import { iconForRecipe } from "@/lib/te-mock/icons";
import { STATUS_META } from "@/components/precedents-v2/StatusChip";
import type { PatternEntry } from "@/lib/te-mock/patterns-v4-data";
import { PatternShapeSparkline } from "./PatternShapeSparkline";

const L1_SHORT: Record<string, string> = {
  A: "Polit",
  B: "Confl",
  C: "Gov",
  D: "Econ",
  E: "Social",
  F: "Diplo",
  G: "Human",
  H: "Struc",
};

export interface PatternCardProps {
  pattern: PatternEntry;
}

export function PatternCard({ pattern }: PatternCardProps) {
  const statusMeta = STATUS_META[pattern.status];
  const isQueued = pattern.status === "queued";

  return (
    <Link
      href={`/patterns-v4/${pattern.id}` as Route}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <article
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "8px",
          padding: "14px",
          minHeight: "300px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          transition: "border-color 0.15s",
          cursor: "pointer",
          opacity: isQueued ? 0.7 : 1,
        }}
      >
        {/* Top — icon + L1 chip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: pattern.l1_color,
              border: `1px solid ${pattern.l1_color}`,
              borderRadius: "5px",
              background: "rgba(255,255,255,0.02)",
              flexShrink: 0,
            }}
          >
            <RecipeIcon recipeId={pattern.recipe_id} size={24} strokeWidth={1.6} />
          </div>
          <span
            style={{
              fontSize: "10px",
              padding: "3px 8px",
              border: `1px solid ${pattern.l1_color}`,
              color: pattern.l1_color,
              borderRadius: "4px",
              letterSpacing: "0.5px",
              fontFamily: "ui-monospace, monospace",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: pattern.l1_color,
              }}
            />
            {pattern.l1_id} · {L1_SHORT[pattern.l1_id] ?? pattern.l1_id}
          </span>
        </div>

        {/* Name + sub-class */}
        <div>
          <div
            style={{
              fontSize: "14.5px",
              fontWeight: 600,
              lineHeight: 1.25,
              color: "var(--qgi-text)",
              marginBottom: "3px",
            }}
          >
            {pattern.name}
          </div>
          <div
            style={{ fontSize: "11px", color: "var(--qgi-text-muted)", lineHeight: 1.35 }}
          >
            {pattern.l2_label}
          </div>
        </div>

        {/* Shape preview */}
        <div
          style={{
            background: "var(--qgi-bg)",
            border: "1px solid var(--qgi-border)",
            borderRadius: "5px",
            padding: "6px 8px",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "1px",
              color: "var(--qgi-text-dim)",
              fontFamily: "ui-monospace, monospace",
              marginBottom: "4px",
            }}
          >
            CANONICAL SHAPE · {pattern.window_y}y WINDOW
          </div>
          <PatternShapeSparkline
            points={pattern.shape_points}
            color={pattern.l1_color}
            windowY={pattern.window_y}
            variant="card"
            height={70}
          />
        </div>

        {/* Metric strip */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          <Chip label={`${pattern.window_y}y window`} />
          <Chip
            label={`${pattern.n_positives || "—"} positives`}
            muted={!pattern.n_positives}
          />
        </div>

        {/* Foot — avg match + status + open arrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: "10px",
            borderTop: "1px solid var(--qgi-border)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <div
              style={{
                fontSize: "9px",
                letterSpacing: "1px",
                color: "var(--qgi-text-dim)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              AVG MATCH (TOP-10)
            </div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: pattern.l1_color,
                fontFamily: "ui-monospace, monospace",
                lineHeight: 1,
              }}
            >
              {pattern.avg_match_score.toFixed(1)}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "6px",
            }}
          >
            <span
              style={{
                fontSize: "9.5px",
                padding: "2px 7px",
                borderRadius: "10px",
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.3px",
                background: statusMeta.bgAlpha,
                color: statusMeta.color,
                border: `1px solid ${statusMeta.color}`,
              }}
            >
              {statusMeta.label}
            </span>
            <span
              style={{
                fontSize: "10px",
                color: "var(--qgi-text-muted)",
                fontFamily: "ui-monospace, monospace",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              open
              <ArrowRight size={10} />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function Chip({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      style={{
        fontSize: "10px",
        padding: "3px 7px",
        borderRadius: "3px",
        border: "1px solid var(--qgi-border)",
        background: "rgba(255,255,255,0.02)",
        color: muted ? "var(--qgi-text-dim)" : "var(--qgi-text-muted)",
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.3px",
      }}
    >
      {label}
    </span>
  );
}
