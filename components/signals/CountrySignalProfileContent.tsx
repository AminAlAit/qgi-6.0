"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { SignalRow, SignalsResponse } from "@/lib/types";
import { DataFreshness } from "@/components/DataFreshness";

export function CountrySignalProfileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCountry = searchParams.get("country") ?? "";

  const [country, setCountry] = useState(initialCountry);
  const [query, setQuery] = useState(initialCountry);
  const [payload, setPayload] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);

  const signals: SignalRow[] = payload?.results ?? [];

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

  const fetchSignals = useCallback(async (name: string) => {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/country?country=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SignalsResponse = await res.json();
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCountry) fetchSignals(initialCountry);
  }, [initialCountry, fetchSignals]);

  function handleSearch() {
    if (!query.trim()) return;
    setCountry(query.trim());
    router.replace(`/signals/country?country=${encodeURIComponent(query.trim())}`, {
      scroll: false,
    });
    fetchSignals(query.trim());
  }

  const byCategory = signals.reduce<Record<string, SignalRow[]>>((acc, s) => {
    const cat = s.event_category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  // T7 #300 MEDIUM fix (2026-04-19): sort by the same PPS value the
  // detail card displays. Previously sorted by raw `pattern_power_score`
  // while the card read `pps`, producing inconsistent ordering between
  // the list and what the user sees inside each card.
  const categories = Object.keys(byCategory).sort((a, b) => {
    const ppsB = byCategory[b][0].pps ?? byCategory[b][0].pattern_power_score ?? 0;
    const ppsA = byCategory[a][0].pps ?? byCategory[a][0].pattern_power_score ?? 0;
    return ppsB - ppsA;
  });

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center gap-3">
        <h1
          className="text-xs tracking-[0.2em] uppercase font-semibold"
          style={{ color: "var(--qgi-accent)" }}
        >
          Country Signal Profile
        </h1>
        {payload && (
          <DataFreshness generatedAt={payload.generated_at} label="Live query" />
        )}
      </div>

      <p
        className="text-[11px] leading-relaxed"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        Select a country to see its active signals — patterns where this country is
        currently following another country&apos;s historical trajectory, with matching
        events on both sides forming a structural precedent.
      </p>

      <div
        className="flex gap-2 items-end p-3 rounded border"
        style={{
          backgroundColor: "var(--qgi-surface)",
          borderColor: "var(--qgi-border)",
        }}
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

      <div className="flex-1 overflow-y-auto flex flex-col gap-3">
        {loading ? (
          <div
            className="flex items-center justify-center py-16 text-xs tracking-wider"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            LOADING SIGNALS...
          </div>
        ) : error ? (
          <div
            className="flex items-center justify-center py-16 text-xs tracking-wider"
            style={{ color: "var(--qgi-danger)" }}
          >
            {error}
          </div>
        ) : !country ? (
          <div
            className="flex items-center justify-center py-16 text-xs tracking-wider"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            SELECT A COUNTRY TO VIEW ITS SIGNAL PROFILE
          </div>
        ) : signals.length === 0 ? (
          <div
            className="flex items-center justify-center py-16 text-xs tracking-wider"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            NO ACTIVE SIGNALS FOR {country.toUpperCase()}
          </div>
        ) : (
          <>
            <div
              className="flex items-center justify-between px-4 py-2 rounded border"
              style={{
                backgroundColor: "var(--qgi-surface)",
                borderColor: "var(--qgi-border)",
              }}
            >
              <span className="text-xs font-data" style={{ color: "var(--qgi-text)" }}>
                {country}
              </span>
              <div className="flex gap-4">
                <span
                  className="text-[10px] font-data"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {signals.length} active signal{signals.length !== 1 ? "s" : ""}
                </span>
                <span
                  className="text-[10px] font-data"
                  style={{ color: "var(--qgi-text-muted)" }}
                >
                  {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
                </span>
              </div>
            </div>

            {categories.map((cat) => (
              <div
                key={cat}
                className="rounded border overflow-hidden"
                style={{
                  backgroundColor: "var(--qgi-surface)",
                  borderColor: "var(--qgi-border)",
                }}
              >
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
                  <span
                    className="text-[9px] font-data"
                    style={{ color: "var(--qgi-text-dim)" }}
                  >
                    {byCategory[cat].length} precedent
                    {byCategory[cat].length !== 1 ? "s" : ""}
                  </span>
                </div>

                {byCategory[cat].map((s, i) => (
                  <button
                    key={s.recipe_id + i}
                    onClick={() => {
                      const qs = new URLSearchParams({
                        country_a: String(s.country_a_id),
                        country_b: String(s.country_b_id),
                        length: String(s.length),
                        start_a: String(s.start_year_a),
                        start_b: String(s.start_year_b),
                      });
                      router.push(`/patterns?${qs}`);
                    }}
                    className="w-full text-left px-4 py-3 border-b transition-colors hover:bg-[var(--qgi-surface-2)] last:border-b-0"
                    style={{ borderColor: "var(--qgi-border)" }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-data text-xs"
                          style={{ color: "var(--qgi-country-b)" }}
                        >
                          {s.country_b_name}
                        </span>
                        <span
                          className="text-[9px]"
                          style={{ color: "var(--qgi-text-dim)" }}
                        >
                          ({s.start_year_b}–{s.end_year_b})
                        </span>
                      </div>
                      <span
                        className="font-data text-xs font-bold"
                        style={{
                          color:
                            s.pattern_power_score >= 8
                              ? "var(--qgi-danger)"
                              : s.pattern_power_score >= 5
                                ? "var(--qgi-amber)"
                                : "var(--qgi-success)",
                        }}
                      >
                        PPS {s.pattern_power_score.toFixed(1)}
                      </span>
                    </div>

                    <div
                      className="flex items-center gap-3 text-[10px]"
                      style={{ color: "var(--qgi-text-muted)" }}
                    >
                      <span className="font-data">{s.length}yr</span>
                      <span className="font-data">
                        {(s.avg_correlation * 100).toFixed(0)}% corr
                      </span>
                      <span className="font-data">{s.indicator_count} indicators</span>
                      <span
                        className="truncate max-w-xs"
                        style={{ color: "var(--qgi-text-dim)" }}
                      >
                        {s.event_title_b}
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
