import { describe, expect, it } from "vitest";
import { formatBakeMonthYear, formatDataThrough } from "@/lib/format-bake-date";

describe("formatBakeMonthYear", () => {
  it("formats a valid ISO date as 'Month YYYY'", () => {
    expect(formatBakeMonthYear("2026-04-30")).toBe("April 2026");
    expect(formatBakeMonthYear("2025-12-15")).toBe("December 2025");
    expect(formatBakeMonthYear("2024-01-01")).toBe("January 2024");
  });

  it("returns empty string for falsy or malformed input", () => {
    expect(formatBakeMonthYear(undefined)).toBe("");
    expect(formatBakeMonthYear(null)).toBe("");
    expect(formatBakeMonthYear("")).toBe("");
    expect(formatBakeMonthYear("bad input")).toBe("");
    expect(formatBakeMonthYear("2026/04/30")).toBe("");
    expect(formatBakeMonthYear("2026-13-01")).toBe("");
  });
});

describe("formatDataThrough", () => {
  it("composes 'Data through {Month YYYY}' for valid dates", () => {
    expect(formatDataThrough("2026-04-30")).toBe("Data through April 2026");
  });

  it("falls back to 'Data vintage unknown' for bad input", () => {
    expect(formatDataThrough(undefined)).toBe("Data vintage unknown");
    expect(formatDataThrough("bad")).toBe("Data vintage unknown");
  });
});
