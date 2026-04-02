"use client";

import { useState, useEffect, useCallback } from "react";

export interface PatternSelection {
  country_a: string;
  country_b: string;
  length: number;
  start_a: number;
  start_b: number;
}

interface Props {
  initial?: Partial<PatternSelection>;
  onSelect: (sel: PatternSelection) => void;
}

interface Country {
  id: string;
  name: string;
}

interface Partner {
  country_b_id: string;
  country_b_name: string;
  available_lengths: number[];
}

interface YearPair {
  start_year_a: number;
  start_year_b: number;
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: "Bearer __client__" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export function CascadeFilter({ initial, onSelect }: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [lengths, setLengths] = useState<number[]>([]);
  const [yearPairs, setYearPairs] = useState<YearPair[]>([]);

  const [countryA, setCountryA] = useState(initial?.country_a ?? "");
  const [countryB, setCountryB] = useState(initial?.country_b ?? "");
  const [length, setLength] = useState<number | "">(initial?.length ?? "");
  const [yearPair, setYearPair] = useState<string>(
    initial?.start_a && initial?.start_b
      ? `${initial.start_a}:${initial.start_b}`
      : ""
  );

  // Load countries once
  useEffect(() => {
    apiFetch<Country[]>("/api/countries").then(setCountries).catch(() => {});
  }, []);

  // Load partners when A changes
  useEffect(() => {
    if (!countryA) { setPartners([]); return; }
    apiFetch<Partner[]>(`/api/patterns/partners?country_a=${encodeURIComponent(countryA)}`)
      .then(setPartners)
      .catch(() => setPartners([]));
    setCountryB("");
    setLength("");
    setYearPairs([]);
    setYearPair("");
  }, [countryA]);

  // Load lengths when B changes
  useEffect(() => {
    if (!countryA || !countryB) { setLengths([]); return; }
    apiFetch<number[]>(`/api/patterns/lengths?country_a=${encodeURIComponent(countryA)}&country_b=${encodeURIComponent(countryB)}`)
      .then(setLengths)
      .catch(() => setLengths([]));
    setLength("");
    setYearPairs([]);
    setYearPair("");
  }, [countryA, countryB]);

  // Load year pairs when length changes
  useEffect(() => {
    if (!countryA || !countryB || !length) { setYearPairs([]); return; }
    apiFetch<YearPair[]>(`/api/patterns/years?country_a=${encodeURIComponent(countryA)}&country_b=${encodeURIComponent(countryB)}&length=${length}`)
      .then(setYearPairs)
      .catch(() => setYearPairs([]));
    setYearPair("");
  }, [countryA, countryB, length]);

  // Fire onSelect when all 5 params are set
  useEffect(() => {
    if (!countryA || !countryB || !length || !yearPair) return;
    const [startA, startB] = yearPair.split(":").map(Number);
    onSelect({ country_a: countryA, country_b: countryB, length: Number(length), start_a: startA, start_b: startB });
  }, [countryA, countryB, length, yearPair, onSelect]);

  const inputClass =
    "w-full px-3 py-2 text-xs rounded border bg-transparent outline-none focus:border-[var(--qgi-accent)] transition-colors";
  const inputStyle = {
    borderColor: "var(--qgi-border)",
    color: "var(--qgi-text)",
    backgroundColor: "var(--qgi-surface)",
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <Label step={1} label="Predictor Country" />
      <select
        value={countryA}
        onChange={(e) => setCountryA(e.target.value)}
        className={inputClass}
        style={inputStyle}
      >
        <option value="">Select country…</option>
        {countries.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <Label step={2} label="Following Country" disabled={!countryA} />
      <select
        value={countryB}
        onChange={(e) => setCountryB(e.target.value)}
        className={inputClass}
        style={inputStyle}
        disabled={!countryA || partners.length === 0}
      >
        <option value="">Select country…</option>
        {partners.map((p) => (
          <option key={p.country_b_id} value={p.country_b_id}>{p.country_b_name}</option>
        ))}
      </select>

      <Label step={3} label="Pattern Duration" disabled={!countryB} />
      <select
        value={length}
        onChange={(e) => setLength(Number(e.target.value))}
        className={inputClass}
        style={inputStyle}
        disabled={!countryB || lengths.length === 0}
      >
        <option value="">Select length…</option>
        {lengths.map((l) => (
          <option key={l} value={l}>{l} years</option>
        ))}
      </select>

      <Label step={4} label="Year Window" disabled={!length} />
      <select
        value={yearPair}
        onChange={(e) => setYearPair(e.target.value)}
        className={inputClass}
        style={inputStyle}
        disabled={!length || yearPairs.length === 0}
      >
        <option value="">Select window…</option>
        {yearPairs.map((yp) => (
          <option
            key={`${yp.start_year_a}:${yp.start_year_b}`}
            value={`${yp.start_year_a}:${yp.start_year_b}`}
          >
            {yp.start_year_a}–{yp.start_year_a + Number(length) - 1} / {yp.start_year_b}–{yp.start_year_b + Number(length) - 1}
          </option>
        ))}
      </select>
    </div>
  );
}

function Label({ step, label, disabled }: { step: number; label: string; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-data font-semibold shrink-0"
        style={{
          backgroundColor: disabled ? "var(--qgi-border)" : "var(--qgi-accent)",
          color: disabled ? "var(--qgi-text-dim)" : "var(--qgi-bg)",
        }}
      >
        {step}
      </span>
      <span
        className="text-[10px] tracking-widest uppercase"
        style={{ color: disabled ? "var(--qgi-text-dim)" : "var(--qgi-text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}
