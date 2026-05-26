"use client";

/**
 * CountryPicker — client component. The hero picker that selects which
 * "current country" the page renders analogs for. Static-feeling client-side
 * selection per spec; mocks the lookup.
 *
 * Uses React state only — no router push, no URL params. The parent page
 * is server-rendered once with all entries; this picker swaps the visible
 * results panel locally. (Keeps the page snappy and avoids a Promise<>
 * searchParams round-trip for what is fundamentally a demo selector.)
 */
import { useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import type { CurrentCountryEntry } from "@/lib/te-mock/nearest-analog-data";
import { AnalogResults } from "./AnalogResults";

export interface CountryPickerProps {
  entries: CurrentCountryEntry[];
  defaultIso: string;
}

export function CountryPicker({ entries, defaultIso }: CountryPickerProps) {
  const [iso, setIso] = useState<string>(defaultIso);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = entries.find((e) => e.iso === iso) ?? entries[0];
  const filtered = entries.filter(
    (e) =>
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.iso.toLowerCase().includes(query.toLowerCase()) ||
      e.region.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      {/* Picker */}
      <div
        style={{
          background: "var(--qgi-surface)",
          border: "1px solid var(--qgi-border)",
          borderRadius: "10px",
          padding: "18px 20px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            fontSize: "9px",
            letterSpacing: "1.8px",
            color: "var(--qgi-accent)",
            fontFamily: "ui-monospace, monospace",
            marginBottom: "10px",
            fontWeight: 600,
          }}
        >
          PICK A COUNTRY · TODAY
        </div>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="listbox"
            style={{
              width: "100%",
              padding: "14px 16px",
              background: "var(--qgi-bg)",
              border: `1px solid ${open ? "var(--qgi-accent)" : "var(--qgi-border)"}`,
              borderRadius: "8px",
              color: "var(--qgi-text)",
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "border-color 0.15s",
              fontFamily: "inherit",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Search size={16} strokeWidth={1.8} color="var(--qgi-text-muted)" />
              <span style={{ fontWeight: 600 }}>{selected.name}</span>
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 7px",
                  borderRadius: "3px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--qgi-border)",
                  color: "var(--qgi-text-muted)",
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.3px",
                }}
              >
                {selected.iso} · {selected.region}
              </span>
            </span>
            <ChevronDown
              size={18}
              strokeWidth={1.8}
              color="var(--qgi-text-muted)"
              style={{
                transition: "transform 0.15s",
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {open && (
            <div
              role="listbox"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                zIndex: 20,
                background: "var(--qgi-surface)",
                border: "1px solid var(--qgi-accent)",
                borderRadius: "8px",
                padding: "8px",
                maxHeight: "380px",
                overflow: "auto",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by country, ISO, region…"
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--qgi-bg)",
                  border: "1px solid var(--qgi-border)",
                  borderRadius: "6px",
                  color: "var(--qgi-text)",
                  fontSize: "13px",
                  outline: "none",
                  fontFamily: "inherit",
                  marginBottom: "8px",
                }}
              />
              {filtered.length === 0 && (
                <div
                  style={{
                    padding: "16px",
                    fontSize: "12px",
                    color: "var(--qgi-text-dim)",
                    fontStyle: "italic",
                    textAlign: "center",
                  }}
                >
                  No matches in the mock corpus. Try Egypt, Lebanon, Iran, Türkiye,
                  Pakistan…
                </div>
              )}
              {filtered.map((e) => {
                const active = e.iso === iso;
                return (
                  <button
                    key={e.iso}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setIso(e.iso);
                      setOpen(false);
                      setQuery("");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "9px 12px",
                      background: active ? "rgba(56,189,248,0.12)" : "transparent",
                      border: `1px solid ${active ? "var(--qgi-accent)" : "transparent"}`,
                      borderRadius: "5px",
                      color: "var(--qgi-text)",
                      fontSize: "13px",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      marginBottom: "2px",
                    }}
                  >
                    <span style={{ fontWeight: active ? 600 : 500 }}>{e.name}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--qgi-text-dim)",
                        fontFamily: "ui-monospace, monospace",
                        letterSpacing: "0.3px",
                      }}
                    >
                      {e.iso} · {e.region}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div
          style={{
            marginTop: "10px",
            fontSize: "11px",
            color: "var(--qgi-text-dim)",
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          Mock corpus: {entries.length} countries. The selected country&apos;s recent
          12-quarter composite indicator trajectory is matched against pre-event
          trajectories of every historical positive in the recipe library.
        </div>
      </div>

      {/* Results — swaps on selection */}
      <AnalogResults entry={selected} />
    </div>
  );
}
