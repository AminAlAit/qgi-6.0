"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/design/CountryFlag";

interface SignalCountry {
  id: string;
  name: string;
  alpha_2: string;
  salience: number;
  recipes: number;
  curated: boolean;
}

interface Signal {
  category: string;
  countries: SignalCountry[];
  totalRecipes: number;
  avgSalience: number;
  maxSalience: number;
}

export function SignalsBrowseClient({ signals }: { signals: Signal[] }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"salience" | "countries" | "recipes">("salience");

  const filtered = useMemo(() => {
    let result = signals;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        formatCategory(s.category).toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case "countries":
        result = [...result].sort((a, b) => b.countries.length - a.countries.length);
        break;
      case "recipes":
        result = [...result].sort((a, b) => b.totalRecipes - a.totalRecipes);
        break;
      default:
        result = [...result].sort((a, b) => b.maxSalience - a.maxSalience);
    }
    return result;
  }, [signals, search, sortBy]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-xs tracking-widest uppercase mb-1"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          Signals
        </h1>
        <p className="text-sm" style={{ color: "var(--qgi-text-muted)" }}>
          Historical risk archetypes — the economic trajectories that preceded
          geopolitical events. Each Signal represents an event type with active
          precedents.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search signals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded border text-sm flex-1 max-w-xs outline-none transition-colors focus:border-[var(--qgi-accent)]"
          style={{
            backgroundColor: "var(--qgi-surface)",
            borderColor: "var(--qgi-border)",
            color: "var(--qgi-text)",
          }}
        />
        <div className="flex gap-2">
          <SortChip
            label="By Salience"
            active={sortBy === "salience"}
            onClick={() => setSortBy("salience")}
          />
          <SortChip
            label="By Countries"
            active={sortBy === "countries"}
            onClick={() => setSortBy("countries")}
          />
          <SortChip
            label="By Precedents"
            active={sortBy === "recipes"}
            onClick={() => setSortBy("recipes")}
          />
        </div>
      </div>

      {/* Signal Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((signal) => (
          <SignalCard key={signal.category} signal={signal} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div
          className="text-center py-12 text-sm"
          style={{ color: "var(--qgi-text-dim)" }}
        >
          No signals match your search.
        </div>
      )}

      {/* Summary */}
      <div
        className="mt-6 text-center text-[10px]"
        style={{ color: "var(--qgi-text-dim)" }}
      >
        {signals.length} active signals across{" "}
        {new Set(signals.flatMap((s) => s.countries.map((c) => c.id))).size}{" "}
        countries
      </div>
    </div>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const salienceColor =
    signal.maxSalience >= 1.2
      ? "#f87171"
      : signal.maxSalience >= 0.5
        ? "#fbbf24"
        : "#38bdf8";

  const topCountries = signal.countries.slice(0, 5);

  return (
    <div
      className="rounded-lg border p-5 transition-colors hover:border-[var(--qgi-accent)]"
      style={{
        backgroundColor: "var(--qgi-surface)",
        borderColor: "var(--qgi-border)",
      }}
    >
      {/* Signal name + salience */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-medium leading-snug">
          {formatCategory(signal.category)}
        </h3>
        <span
          className="font-data text-xs font-bold shrink-0 ml-2"
          style={{ color: salienceColor }}
        >
          {signal.maxSalience.toFixed(1)}
        </span>
      </div>

      {/* Stats row */}
      <div
        className="flex gap-4 mb-3 text-[10px] font-data"
        style={{ color: "var(--qgi-text-muted)" }}
      >
        <span>{signal.countries.length} countries</span>
        <span>{signal.totalRecipes.toLocaleString()} precedent windows</span>
      </div>

      {/* Top countries following this signal */}
      <div className="space-y-1.5">
        {topCountries.map((country) => (
          <Link
            key={country.id}
            href={`/countries/${country.id}/${encodeURIComponent(signal.category)}`}
            className="flex items-center gap-2 py-1 px-2 rounded transition-colors hover:bg-[var(--qgi-surface-2)]"
          >
            <CountryFlag alpha2={country.alpha_2} size={14} />
            <span className="text-xs flex-1 truncate">{country.name}</span>
            <span
              className="font-data text-[10px]"
              style={{
                color:
                  country.salience >= 1.2
                    ? "#f87171"
                    : country.salience >= 0.5
                      ? "#fbbf24"
                      : "var(--qgi-text-dim)",
              }}
            >
              {country.salience.toFixed(1)}
            </span>
          </Link>
        ))}
        {signal.countries.length > 5 && (
          <div
            className="text-[10px] pl-2"
            style={{ color: "var(--qgi-text-dim)" }}
          >
            +{signal.countries.length - 5} more countries
          </div>
        )}
      </div>
    </div>
  );
}

function SortChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded text-[10px] tracking-wider uppercase border transition-colors"
      style={{
        backgroundColor: active ? "var(--qgi-accent-glow)" : "transparent",
        borderColor: active ? "var(--qgi-accent)" : "var(--qgi-border)",
        color: active ? "var(--qgi-accent)" : "var(--qgi-text-muted)",
      }}
    >
      {label}
    </button>
  );
}

function formatCategory(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
