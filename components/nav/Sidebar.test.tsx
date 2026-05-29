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

  it("renders the 8 canonical V4.1 entries", () => {
    render(<Sidebar />);
    // 2026-05-29 V4.1 round-3 amendment: Recipe Tracker route deleted; the
    // catalog ledger view is now folded into /recipes via the per-card
    // Confidence badge. The blog post at /blog/recipe-tracker is unrelated
    // and unaffected.
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Recipes")).toBeInTheDocument();
    expect(screen.getByText("Countries")).toBeInTheDocument();
    expect(screen.getByText("Risk Board")).toBeInTheDocument();
    expect(screen.getByText("Compound Risk")).toBeInTheDocument();
    expect(screen.getByText("Compare")).toBeInTheDocument();
    expect(screen.getByText("Nearest Analog")).toBeInTheDocument();
    expect(screen.getByText("Patterns")).toBeInTheDocument();
    // "Recipe Tracker" sidebar entry removed 2026-05-29.
    expect(screen.queryByText("Recipe Tracker")).not.toBeInTheDocument();
  });

  it("does NOT render any legacy or removed entries", () => {
    render(<Sidebar />);
    const removed = [
      // Removed V3 entries
      "Signals",
      // Old V4.1 label suffixes
      "Dashboard V4.1",
      "Recipes V4.1",
      "Countries V4.1",
      "Patterns V4",
      // TE Mockup group header
      "TE Mockup (local)",
      // Old V1/V2 sub-entries
      "Country browser",
      "Recipe catalogue",
      "Active signals",
      "Pattern atlas",
      "Power ranking",
    ];
    for (const label of removed) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("renders no LIVE or PREVIEW chips (all entries are PRIMARY, no chip rendered)", () => {
    render(<Sidebar />);
    // NavLeafLink does not render the badge chip in the current implementation.
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
    expect(screen.queryByText("PREVIEW")).not.toBeInTheDocument();
    expect(screen.queryByText("PRIMARY")).not.toBeInTheDocument();
  });
});
