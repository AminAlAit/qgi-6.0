import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("Sidebar", () => {
  it("renders the QGI wordmark", () => {
    render(<Sidebar />);
    expect(screen.getByText("QGI")).toBeInTheDocument();
  });

  it("renders all nav items", () => {
    render(<Sidebar />);
    expect(screen.getByText("DASHBOARD")).toBeInTheDocument();
    expect(screen.getByText("PATTERNS")).toBeInTheDocument();
    expect(screen.getByText("RANKING")).toBeInTheDocument();
    // #121: renamed from "TOP 50 ALERTS" / "EARLY WARNING"
    expect(screen.getByText("ACTIVE SIGNALS")).toBeInTheDocument();
    expect(screen.getByText("COUNTRY PROFILE")).toBeInTheDocument();
  });
});
