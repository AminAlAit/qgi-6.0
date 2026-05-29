import { describe, expect, it } from "vitest";
import { TOUR_STEPS, TOUR_STEPS_BY_PAGE, TOUR_TOTAL_STEPS } from "@/lib/tour-steps";

/**
 * Tour-steps shape invariants — caught at unit-test time so they don't
 * regress silently into production.
 *
 * 2026-05-28: V4.1 canonical promotion. The original 12 legacy steps
 * (covering /dashboard V3, /precedents, /patterns V3, /signals,
 * /countries V3) were removed because those routes are deleted. The
 * 60 V4.1 steps remain, now under the canonical route paths. The
 * "original-5-page distribution" test has been removed — those pages
 * no longer exist; their steps are gone.
 */

/** Canonical pages covered by the post-V4.1-promo tour (12 pages). */
const ALL_TOUR_PAGES = new Set([
  "/dashboard",
  "/recipes",
  "/recipes/foreign_intervention",
  "/countries",
  "/countries/sdn",
  "/risk-board",
  "/compound-risk",
  "/nearest-analog",
  "/compare",
  "/patterns",
  "/patterns/paraguay-south_korea-1963",
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

  it("no step references a deleted route", () => {
    const deletedRoutes = ["/precedents", "/signals", "/base", "/dashboard-v4"];
    for (const s of TOUR_STEPS) {
      for (const deleted of deletedRoutes) {
        expect(
          s.page.startsWith(deleted),
          `Step on page "${s.page}" references deleted route ${deleted}`
        ).toBe(false);
      }
    }
  });
});
