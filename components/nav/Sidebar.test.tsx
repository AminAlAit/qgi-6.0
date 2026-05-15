import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("Sidebar", () => {
  it("renders the QG Intelligence wordmark", () => {
    // Wordmark is two spans: "QG" + "Intelligence" — matches the domain
    // qgintelligence.com (ref #245). Older test checked a single "QGI"
    // string that hasn't existed since the wordmark was split.
    render(<Sidebar />);
    expect(screen.getByText("QG")).toBeInTheDocument();
    expect(screen.getByText("Intelligence")).toBeInTheDocument();
  });

  it("renders the 5 flat top-level entries (Dashboard + 4 families)", () => {
    render(<Sidebar />);
    // 2026-05-15 PR-i flat restructure: sidebar is now 5 standalone entries,
    // no group headers, no V1/V2 sub-entries. The 4 family routes point at
    // the (still `-merged`-named) canonical V3 shells; PR-iii will rename
    // those URLs to unsuffixed canonical and flip V1 to `-v1`.
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Precedents")).toBeInTheDocument();
    expect(screen.getByText("Countries")).toBeInTheDocument();
    expect(screen.getByText("Signals")).toBeInTheDocument();
    expect(screen.getByText("Patterns")).toBeInTheDocument();
  });

  it("does NOT render any legacy V1 / V2 sub-entries", () => {
    render(<Sidebar />);
    // These were the V1 + V2 family sub-entries removed in PR-i. The routes
    // remain reachable by direct URL but are no longer in nav.
    const removed = [
      "Country browser",
      "Recipe catalogue",
      "Active signals",
      "Pattern atlas",
      "Power ranking",
      "V2 — Table",
      "V2 — Narrative",
      "V2 — Tufte",
      "V2 — Lloyd's",
      "Discover — Tabs",
      "Discover — Facets",
      "Merged preview",
    ];
    for (const label of removed) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("renders only LIVE chips (no PREVIEW labels after flat restructure)", () => {
    render(<Sidebar />);
    // All 5 entries are surfaced as LIVE in the new top-level. PREVIEW chips
    // were attached to the V1/V2 sub-entries which no longer appear in nav.
    expect(screen.getAllByText("LIVE").length).toBe(5);
    expect(screen.queryByText("PREVIEW")).not.toBeInTheDocument();
  });
});
