"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { RecipeRow } from "@/lib/types";

export default function EarlyWarningPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCountry = searchParams.get("country") ?? "";

  const [country, setCountry] = useState(initialCountry);
  const [query, setQuery] = useState(initialCountry);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);

  // Load country list for autocomplete
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/countries");
        if (!res.ok) return;
        const data: { id: string; name: string }[] = await res.json();
        setCountries(data.map((c) => c.name).sort());
      } catch {
        // non-critical
      }
    })();
  }, []);

  const fetchRecipes = useCallback(async (name: string) => {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/country?country=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRecipes(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on initial load if country in URL
  useEffect(() => {
    if (initialCountry) fetchRecipes(initialCountry);
  }, [initialCountry, fetchRecipes]);

  function handleSearch() {
    if (!query.trim()) return;
    setCountry(query.trim());
    router.replace(`/patterns/early-warning?country=${encodeURIComponent(query.trim())}`, {
      scroll: false,
    });
    fetchRecipes(query.trim());
  }

  // Group recipes by event_category
  const byCategory = recipes.reduce<Record<string, RecipeRow[]>>((acc, r) => {
    const cat = r.event_category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  const categories = Object.keys(byCategory).sort(
    (a, b) => byCategory[b][0].pattern_power_score - byCategory[a][0].pattern_power_score
  );

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1
          className="text-xs tracking-[0.2em] uppercase font-semibold"
          style={{ color: "var(--qgi-accent)" }}
        >
          Early Warning Signals
        </h1>
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: "var(--qgi-text-muted)" }}>
        Select a country to see active recipe matches — patterns where this country is currently
        following another country&apos;s historical trajectory, with matching events on both sides.
      </p>

      {/* Search bar */}
      <div
        className="flex gap-2 items-end p-3 rounded border"
        style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
      >
        <div className="flex flex-col gap-1 flex-1">
          <label
            className="text-[9px] tracking-[0.15em] uppercase"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            Country
          </label>
          <input
            type="text"
            list="country-list"
            placeholder="e.g. Germany"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="px-3 py-1.5 rounded text-xs font-data border outline-none focus:border-[var(--qgi-accent)]"
            style={{
              backgroundColor: "var(--qgi-bg)",
              borderColor: "var(--qgi-border)",
              color: "var(--qgi-text)",
            }}
          />
          <datalist id="country-list">
            {countries.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-1.5 rounded text-[10px] tracking-wider uppercase font-semibold transition-colors"
          style={{ backgroundColor: "var(--qgi-accent)", color: "var(--qgi-bg)" }}
        >
          Search
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-xs tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
            QUERYING ATHENA...
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-xs tracking-wider" style={{ color: "var(--qgi-danger)" }}>
            {error}
          </div>
        ) : !country ? (
          <div className="flex items-center justify-center py-16 text-xs tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
            SELECT A COUNTRY TO VIEW EARLY WARNING SIGNALS
          </div>
        ) : recipes.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-xs tracking-wider" style={{ color: "var(--qgi-text-dim)" }}>
            NO ACTIVE RECIPES FOR {country.toUpperCase()}
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div
              className="flex items-center justify-between px-4 py-2 rounded border"
              style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
            >
              <span className="text-xs font-data" style={{ color: "var(--qgi-text)" }}>
                {country}
              </span>
              <div className="flex gap-4">
                <span className="text-[10px] font-data" style={{ color: "var(--qgi-text-muted)" }}>
                  {recipes.length} active recipe{recipes.length !== 1 ? "s" : ""}
                </span>
                <span className="text-[10px] font-data" style={{ color: "var(--qgi-text-muted)" }}>
                  {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
                </span>
              </div>
            </div>

            {/* Grouped by category */}
            {categories.map((cat) => (
              <div
                key={cat}
                className="rounded border overflow-hidden"
                style={{ backgroundColor: "var(--qgi-surface)", borderColor: "var(--qgi-border)" }}
              >
                {/* Category header */}
                <div
                  className="flex items-center justify-between px-4 py-2 border-b"
                  style={{ borderColor: "var(--qgi-border)" }}
                >
                  <span
                    className="text-[10px] tracking-[0.15em] uppercase font-semibold"
                    style={{ color: "var(--qgi-accent)" }}
                  >
                    {cat.replace(/_/g, " ")}
                  </span>
                  <span className="text-[9px] font-data" style={{ color: "var(--qgi-text-dim)" }}>
                    {byCategory[cat].length} match{byCategory[cat].length !== 1 ? "es" : ""}
                  </span>
                </div>

                {/* Recipes in this category */}
                {byCategory[cat].map((r, i) => (
                  <button
                    key={r.recipe_id + i}
                    onClick={() => {
                      const qs = new URLSearchParams({
                        country_a: String(r.country_a_id),
                        country_b: String(r.country_b_id),
                        length: String(r.length),
                        start_a: String(r.start_year_a),
                        start_b: String(r.start_year_b),
                      });
                      router.push(`/patterns?${qs}`);
                    }}
                    className="w-full text-left px-4 py-3 border-b transition-colors hover:bg-[var(--qgi-surface-2)] last:border-b-0"
                    style={{ borderColor: "var(--qgi-border)" }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-data text-xs" style={{ color: "var(--qgi-country-a)" }}>
                          {r.country_b_name}
                        </span>
                        <span className="text-[9px]" style={{ color: "var(--qgi-text-dim)" }}>
                          ({r.start_year_b}–{r.end_year_b})
                        </span>
                      </div>
                      <span
                        className="font-data text-xs font-bold"
                        style={{
                          color:
                            r.pattern_power_score >= 8
                              ? "var(--qgi-danger)"
                              : r.pattern_power_score >= 5
                                ? "var(--qgi-amber)"
                                : "var(--qgi-success)",
                        }}
                      >
                        PPS {r.pattern_power_score.toFixed(1)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--qgi-text-muted)" }}>
                      <span className="font-data">{r.length}yr</span>
                      <span className="font-data">{(r.avg_correlation * 100).toFixed(0)}% corr</span>
                      <span className="font-data">{r.indicator_count} indicators</span>
                      <span className="truncate max-w-xs" style={{ color: "var(--qgi-text-dim)" }}>
                        {r.event_title_b}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
