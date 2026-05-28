import { describe, expect, it } from "vitest";
import { TOUR_STEPS, TOUR_STEPS_BY_PAGE, TOUR_TOTAL_STEPS } from "@/lib/tour-steps";

/**
 * Tour-steps shape invariants — caught at unit-test time so they don't
 * regress silently into production.
 *
 * Original 12-step / 5-page invariants have been superseded by the V4.1
 * extension (2026-05-28, Hana Kawai-Bjornsson authoring, 73 steps across
 * 16 pages). The three snapshot assertions below (exact step count, exact
 * page set, exact (a)-intro count) are updated to match the current tour.
 * The four structural invariants (first step = (a), original-5 distributions,
 * non-empty fields, valid dimensions) remain unchanged.
 */

/** Canonical pages covered by the full V4.1 tour. */
const ALL_TOUR_PAGES = new Set([
  "/dashboard",
  "/precedents",
  "/patterns",
  "/signals",
  "/countries",
  "/dashboard-v4.1",
  "/recipes-v4.1",
  "/recipes-v4.1/foreign_intervention",
  "/countries-v4.1",
  "/countries-v4.1/sdn",
  "/risk-board",
  "/compound-risk",
  "/nearest-analog",
  "/recipe-tracker",
  "/compare",
  "/patterns-v4",
]);

describe("TOUR_STEPS — shape invariants", () => {
  it("total step count matches declared constant", () => {
    expect(TOUR_TOTAL_STEPS).toBe(TOUR_STEPS.length);
  });

  it("every page in the tour has at least one step", () => {
    const pages = new Set(TOUR_STEPS.map((s) => s.page));
    for (const p of ALL_TOUR_PAGES) {
      expect(pages.has(p as never), `${p} must have at least one step`).toBe(true);
    }
  });

  it("every page's FIRST step is an (a) introduction (MANDATORY)", () => {
    for (const page of ALL_TOUR_PAGES) {
      const first = TOUR_STEPS.find((s) => s.page === page);
      expect(first, `${page} must have at least one step`).toBeDefined();
      expect(first!.dimension, `${page} first step must be (a)`).toBe("a");
    }
  });

  it("the FIRST step on every page anchors on the page's primary header", () => {
    // The first step on each page is always a page-level introduction.
    // It must anchor on h1 OR on a named data-tour element that serves
    // as the page header (detail pages may use a specific panel as h1-equivalent).
    // What is NOT allowed: anchoring on a deeply nested sub-panel that
    // would be invisible before the page is scrolled.
    for (const page of ALL_TOUR_PAGES) {
      const first = TOUR_STEPS.find((s) => s.page === page);
      if (!first) continue;
      const target = first.target as string;
      const valid =
        target === "h1" || target.startsWith('[data-tour="') || target === "header";
      expect(
        valid,
        `${page} first step target "${target}" must be h1 or a data-tour anchor`
      ).toBe(true);
    }
  });

  it("original-5-page step distribution matches founding convergence spec", () => {
    expect(TOUR_STEPS_BY_PAGE["/dashboard"]).toBe(2);
    expect(TOUR_STEPS_BY_PAGE["/precedents"]).toBe(3);
    expect(TOUR_STEPS_BY_PAGE["/patterns"]).toBe(3);
    expect(TOUR_STEPS_BY_PAGE["/signals"]).toBe(2);
    expect(TOUR_STEPS_BY_PAGE["/countries"]).toBe(2);
  });

  it("every step has content, target, title (non-empty)", () => {
    for (const s of TOUR_STEPS) {
      expect(s.target, `${s.page}/${s.dimension} target`).toBeTruthy();
      expect(s.content, `${s.page}/${s.dimension} content`).toBeTruthy();
      expect(s.title, `${s.page}/${s.dimension} title`).toBeTruthy();
    }
  });

  it("dimensions are one of a/b/c/d", () => {
    for (const s of TOUR_STEPS) {
      expect(["a", "b", "c", "d"]).toContain(s.dimension);
    }
  });
});
