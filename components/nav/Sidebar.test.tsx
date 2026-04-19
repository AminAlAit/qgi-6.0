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

  it("renders all nav items", () => {
    render(<Sidebar />);
    // Current sidebar (2026-04-19): DASHBOARD, COUNTRIES, PRECEDENTS,
    // SIGNALS, PATTERNS, RANKING. "ABOUT" was moved out to the public
    // navbar; older "ACTIVE SIGNALS" / "COUNTRY PROFILE" labels were
    // renamed to SIGNALS / COUNTRIES during #121/#248.
    expect(screen.getByText("DASHBOARD")).toBeInTheDocument();
    expect(screen.getByText("COUNTRIES")).toBeInTheDocument();
    expect(screen.getByText("PRECEDENTS")).toBeInTheDocument();
    expect(screen.getByText("SIGNALS")).toBeInTheDocument();
    expect(screen.getByText("PATTERNS")).toBeInTheDocument();
    expect(screen.getByText("RANKING")).toBeInTheDocument();
  });
});
