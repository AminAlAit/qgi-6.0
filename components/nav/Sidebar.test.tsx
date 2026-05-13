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

  it("renders all family group headers", () => {
    render(<Sidebar />);
    // 2026-05-13 (A3 Family 1 PR #4): nav refactored from flat 15-item list
    // into family-grouped sections. The flat-list `RANKING` label is gone
    // — it's now an item ("Power ranking") inside the Patterns group.
    // Dashboard is the only standalone top-level entry.
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Countries")).toBeInTheDocument();
    expect(screen.getByText("Precedents")).toBeInTheDocument();
    expect(screen.getByText("Signals")).toBeInTheDocument();
    expect(screen.getByText("Patterns")).toBeInTheDocument();
  });

  it("renders Merged preview entries across families", () => {
    render(<Sidebar />);
    // A3 merger previews surface in their family groups so the founder can
    // compare V1 / V2 / Merged side-by-side before PR #5 cutover. Family 1
    // (Precedents) shipped its merged-preview entry in PR #4; Family 2
    // (Countries) added one in its PR #1. Each subsequent family adds its
    // own — getAllByText keeps the assertion future-proof as the count
    // grows (4 total once all families' PR #1 lands).
    expect(screen.getAllByText("Merged preview").length).toBeGreaterThanOrEqual(1);
  });

  it("tags V1 routes LIVE and V2 + Merged routes PREVIEW via NavChip", () => {
    render(<Sidebar />);
    // PR #4 introduces trial-period chip badges. Multiple LIVE + PREVIEW
    // chips appear across the family groups — getAllByText asserts both
    // states are surfaced without binding to specific counts (which evolve
    // as families merge).
    expect(screen.getAllByText("LIVE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PREVIEW").length).toBeGreaterThan(0);
  });
});
