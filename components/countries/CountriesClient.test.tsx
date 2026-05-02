import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { CountriesClient } from "./CountriesClient";
import type { CountryRisk, RiskTier } from "@/lib/country-risks";

/**
 * #574 / AS1 Majles 2026-05-01: when the V1.5.3-era manufactured OVR was
 * cleaned out of CountriesClient, the sort options renamed:
 *   - ovr_desc / ovr_asc  →  intensity_desc / intensity_asc
 *
 * The validation gate (`VALID_SORTS.has(...)`) silently falls back to
 * `DEFAULT_SORT = "tier_desc"` when the URL carries an unknown sort
 * value. This protects bookmarked / shared URLs from before the rename
 * (e.g. `/countries?sort=ovr_desc`) — they still load cleanly, just with
 * the default ordering.
 *
 * The PR-then-Sonnet review (PR #20 comment 4362570671) flagged that the
 * fallback behavior was claimed but unproven. These two tests assert the
 * legacy aliases now silently fall back, plus a positive control on the
 * current valid alias.
 */

// ---------------------------------------------------------------------------
// Mock next/navigation — useSearchParams returns a controllable map; useRouter
// is a no-op so the URL replace doesn't actually fire during render
// ---------------------------------------------------------------------------

const mockSearchParams = new Map<string, string>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
    has: (key: string) => mockSearchParams.has(key),
    toString: () =>
      Array.from(mockSearchParams.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("&"),
  }),
}));

// next/link is server-rendered transparent in tests, but this avoids any
// import-time hydration warning if the mock library evolves.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Minimal fixtures — one country is sufficient to exercise the sort
// initializer; the validation runs before any rows render
// ---------------------------------------------------------------------------

const sampleCountry = {
  id: "1",
  name: "India",
  alpha_2: "IN",
  curated: true,
  overall_risk_tier: "HIGH" as RiskTier,
  tiers: {} as CountryRisk["tiers"],
};

const sampleSalience: Record<string, Record<string, number>> = {
  india: { A: 0.4, B: 0.4, C: 0.4, D: 0.4, E: 0.4, F: 0.4, G: 0.4, H: 0.4 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CountriesClient — URL alias backward compatibility (#574)", () => {
  beforeEach(() => {
    mockSearchParams.clear();
  });

  it("falls back to default sort when ?sort=ovr_desc (legacy alias)", () => {
    mockSearchParams.set("sort", "ovr_desc");
    render(<CountriesClient countries={[sampleCountry]} salienceMap={sampleSalience} />);
    const sort = screen.getByLabelText("Sort countries") as HTMLSelectElement;
    // Legacy ovr_desc is no longer in VALID_SORTS → silently falls back
    expect(sort.value).toBe("tier_desc");
  });

  it("falls back to default sort when ?sort=ovr_asc (legacy alias)", () => {
    mockSearchParams.set("sort", "ovr_asc");
    render(<CountriesClient countries={[sampleCountry]} salienceMap={sampleSalience} />);
    const sort = screen.getByLabelText("Sort countries") as HTMLSelectElement;
    expect(sort.value).toBe("tier_desc");
  });

  it("respects ?sort=intensity_desc (positive control on current valid alias)", () => {
    mockSearchParams.set("sort", "intensity_desc");
    render(<CountriesClient countries={[sampleCountry]} salienceMap={sampleSalience} />);
    const sort = screen.getByLabelText("Sort countries") as HTMLSelectElement;
    expect(sort.value).toBe("intensity_desc");
  });

  it("falls back to default for arbitrary unknown sort values", () => {
    // Belt-and-suspenders: not just legacy aliases — ANY unknown value
    // should fall back, so a future malformed-URL doesn't crash the page.
    mockSearchParams.set("sort", "totally_made_up_sort_key");
    render(<CountriesClient countries={[sampleCountry]} salienceMap={sampleSalience} />);
    const sort = screen.getByLabelText("Sort countries") as HTMLSelectElement;
    expect(sort.value).toBe("tier_desc");
  });
});
