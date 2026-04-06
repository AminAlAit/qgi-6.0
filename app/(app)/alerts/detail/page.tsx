"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { RecipeRow } from "@/lib/types";

export default function AlertDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const recipeId = searchParams.get("id");
  const [recipe, setRecipe] = useState<RecipeRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recipeId) return;
    // Recipe is passed via sessionStorage from the top50/early-warning pages
    const stored = sessionStorage.getItem("qgi-recipe-" + recipeId);
    if (stored) {
      setRecipe(JSON.parse(stored));
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [recipeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-xs tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
        LOADING...
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex items-center justify-center h-full text-xs tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
        RECIPE NOT FOUND
      </div>
    );
  }

  const ppsColor =
    recipe.pattern_power_score >= 8
      ? "var(--qgi-danger)"
      : recipe.pattern_power_score >= 5
        ? "var(--qgi-amber)"
        : "var(--qgi-success)";

  const corrPct = Math.round(recipe.avg_correlation * 100);

  return (
    <div className="flex flex-col h-full p-6 gap-6 overflow-y-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="text-[10px] tracking-wider uppercase self-start"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        &larr; Back
      </button>

      {/* Title */}
      <div>
        <h1 className="text-xs tracking-[0.2em] uppercase font-semibold mb-2" style={{ color: "var(--qgi-accent)" }}>
          Alert Detail
        </h1>
        <div className="flex items-center gap-3">
          <span className="font-data text-lg" style={{ color: "var(--qgi-country-b)" }}>
            {recipe.country_a_name}
          </span>
          <span className="text-xs" style={{ color: "var(--qgi-text-dim)" }}>
            following
          </span>
          <span className="font-data text-lg" style={{ color: "var(--qgi-country-a)" }}>
            {recipe.country_b_name}
          </span>
        </div>
      </div>

      {/* Score card */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "POWER SCORE", value: recipe.pattern_power_score.toFixed(1), color: ppsColor },
          { label: "CORRELATION", value: `${corrPct}%`, color: corrPct >= 80 ? "var(--qgi-success)" : "var(--qgi-amber)" },
          { label: "INDICATORS", value: String(recipe.indicator_count), color: "var(--qgi-text)" },
          { label: "PATTERN LENGTH", value: `${recipe.length} yrs`, color: "var(--qgi-text)" },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded border p-3 text-center"
            style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
          >
            <div className="font-data text-xl font-bold mb-1" style={{ color: m.color }}>
              {m.value}
            </div>
            <div className="text-[8px] tracking-[0.2em] uppercase" style={{ color: "var(--qgi-text-dim)" }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Event category */}
      <div
        className="rounded border p-4"
        style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
      >
        <div className="text-[9px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--qgi-text-dim)" }}>
          Matching Event Category
        </div>
        <span
          className="px-3 py-1 rounded text-xs tracking-wider uppercase font-data"
          style={{ backgroundColor: "var(--qgi-surface-2)", color: "var(--qgi-accent)" }}
        >
          {recipe.event_category.replace(/_/g, " ")}
        </span>
      </div>

      {/* Timeline comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Predictor (B) */}
        <div
          className="rounded border p-4"
          style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
        >
          <div className="text-[9px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--qgi-text-dim)" }}>
            Predictor (Historical)
          </div>
          <div className="font-data text-sm mb-2" style={{ color: "var(--qgi-country-a)" }}>
            {recipe.country_b_name}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--qgi-text-dim)" }}>Pattern window</span>
              <span className="font-data" style={{ color: "var(--qgi-text-muted)" }}>
                {recipe.start_year_b} – {recipe.end_year_b}
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--qgi-text-dim)" }}>Event year</span>
              <span className="font-data" style={{ color: "var(--qgi-text-muted)" }}>
                {recipe.event_year_b}
              </span>
            </div>
            <div className="text-[10px] mt-1" style={{ color: "var(--qgi-text-muted)" }}>
              {recipe.event_title_b}
            </div>
          </div>
        </div>

        {/* Following (A) */}
        <div
          className="rounded border p-4"
          style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
        >
          <div className="text-[9px] tracking-[0.15em] uppercase mb-3" style={{ color: "var(--qgi-text-dim)" }}>
            Following (Active Now)
          </div>
          <div className="font-data text-sm mb-2" style={{ color: "var(--qgi-country-b)" }}>
            {recipe.country_a_name}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--qgi-text-dim)" }}>Pattern window</span>
              <span className="font-data" style={{ color: "var(--qgi-text-muted)" }}>
                {recipe.start_year_a} – {recipe.end_year_a}
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span style={{ color: "var(--qgi-text-dim)" }}>Event year</span>
              <span className="font-data" style={{ color: "var(--qgi-text-muted)" }}>
                {recipe.event_year_a}
              </span>
            </div>
            <div className="text-[10px] mt-1" style={{ color: "var(--qgi-text-muted)" }}>
              {recipe.event_title_a}
            </div>
          </div>
        </div>
      </div>

      {/* Event window explanation */}
      <div
        className="rounded border p-4"
        style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
      >
        <div className="text-[9px] tracking-[0.15em] uppercase mb-2" style={{ color: "var(--qgi-text-dim)" }}>
          How this prediction works
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
          {recipe.country_b_name} and {recipe.country_a_name} share a {recipe.length}-year pattern of
          {" "}{recipe.indicator_count} correlated indicators ({corrPct}% avg correlation).
          {" "}{recipe.country_b_name}&apos;s pattern started in {recipe.start_year_b} and ended in {recipe.end_year_b},
          followed by &quot;{recipe.event_title_b}&quot; in {recipe.event_year_b}.
          {" "}{recipe.country_a_name}&apos;s matching pattern started in {recipe.start_year_a} and ends in {recipe.end_year_a} —
          meaning a similar event (&quot;{recipe.event_category.replace(/_/g, " ")}&quot;) may follow.
        </p>
      </div>

      {/* Navigate to underlying pattern */}
      <button
        onClick={() => {
          const qs = new URLSearchParams({
            country_a: String(recipe.country_a_id),
            country_b: String(recipe.country_b_id),
            length: String(recipe.length),
            start_a: String(recipe.start_year_a),
            start_b: String(recipe.start_year_b),
          });
          router.push(`/patterns?${qs}`);
        }}
        className="self-start px-4 py-2 rounded text-[10px] tracking-wider uppercase font-semibold border transition-colors hover:bg-[var(--qgi-surface-2)]"
        style={{ borderColor: "var(--qgi-accent)", color: "var(--qgi-accent)" }}
      >
        View Underlying Pattern &rarr;
      </button>
    </div>
  );
}
