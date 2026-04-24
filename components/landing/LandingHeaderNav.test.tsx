import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingHeaderNav } from "./LandingHeaderNav";

describe("LandingHeaderNav", () => {
  it("renders always-visible links (Methodology, About, Open Dashboard)", () => {
    render(<LandingHeaderNav />);
    expect(screen.getByText("Methodology")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
    expect(screen.getByText("Open Dashboard")).toBeInTheDocument();
  });

  it("renders Reports/Blog/Contact in the desktop inline set", () => {
    render(<LandingHeaderNav />);
    // Each appears at least once (as desktop inline link; jsdom can't
    // check `hidden md:inline-flex` at a breakpoint, but the element must
    // exist in the DOM so CSS can decide).
    expect(screen.getAllByText("Reports").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blog").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contact").length).toBeGreaterThan(0);
  });

  it("renders a hamburger button labeled Open menu initially", () => {
    render(<LandingHeaderNav />);
    const btn = screen.getByRole("button", { name: /open menu/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles aria-expanded + reveals Reports/Blog/Contact when clicked (#427)", () => {
    render(<LandingHeaderNav />);
    const btn = screen.getByRole("button", { name: /open menu/i });

    // Initial state: aria-expanded=false, mobile menu NOT in DOM
    expect(screen.queryByRole("button", { name: /close menu/i })).toBeNull();

    fireEvent.click(btn);

    // After click: aria-expanded=true, mobile drawer appears with 3 extra links
    const closeBtn = screen.getByRole("button", { name: /close menu/i });
    expect(closeBtn).toHaveAttribute("aria-expanded", "true");

    // Reports/Blog/Contact now appear TWICE each (once in the desktop inline
    // set, once in the mobile drawer). Before the click they appeared once.
    expect(screen.getAllByText("Reports").length).toBe(2);
    expect(screen.getAllByText("Blog").length).toBe(2);
    expect(screen.getAllByText("Contact").length).toBe(2);
  });

  it("closes on link click (drawer disappears)", () => {
    render(<LandingHeaderNav />);
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getAllByText("Reports").length).toBe(2);

    // Click the drawer's Reports link (the second occurrence — the desktop
    // one doesn't set onClick).
    const reportsLinks = screen.getAllByText("Reports");
    fireEvent.click(reportsLinks[1]);

    // After close: back to single Reports link (just the desktop inline one).
    expect(screen.getAllByText("Reports").length).toBe(1);
  });
});
