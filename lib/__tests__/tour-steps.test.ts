import { describe, expect, it } from "vitest";
import { TOUR_STEPS, TOUR_STEPS_BY_PAGE, TOUR_TOTAL_STEPS } from "@/lib/tour-steps";

/**
 * Tour-steps shape invariants — caught at unit-test time so they don't
 * regress silently into production. The step content is authored from the
 * 5-persona convergence walkthrough (2026-05-18), and the invariants
 * encode the editorial choices from that synthesis.
 */
describe("TOUR_STEPS — 5-persona convergence shape", () => {
  it("ships exactly 12 steps across 5 pages", () => {
    expect(TOUR_TOTAL_STEPS).toBe(12);
  });

  it("every page has at least one step (5 pages covered)", () => {
    const pages = new Set(TOUR_STEPS.map((s) => s.page));
    expect(pages).toEqual(
      new Set(["/dashboard", "/precedents", "/patterns", "/signals", "/countries"])
    );
  });

  it("every page's FIRST step is an (a) introduction (MANDATORY)", () => {
    for (const page of [
      "/dashboard",
      "/precedents",
      "/patterns",
      "/signals",
      "/countries",
    ] as const) {
      const first = TOUR_STEPS.find((s) => s.page === page);
      expect(first, `${page} must have at least one step`).toBeDefined();
      expect(first!.dimension, `${page} first step must be (a)`).toBe("a");
    }
  });

  it("every (a) intro anchors on `h1` per universal persona convergence", () => {
    const intros = TOUR_STEPS.filter((s) => s.dimension === "a");
    expect(intros).toHaveLength(5);
    for (const s of intros) {
      expect(s.target, `${s.page} (a) must anchor on h1`).toBe("h1");
    }
  });

  it("step distribution matches convergence: 2-3 per page", () => {
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
