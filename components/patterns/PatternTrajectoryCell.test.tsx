import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PatternTrajectoryCell } from "./PatternTrajectoryCell";
import type { PatternTrajectory } from "@/lib/pattern-trajectory";

const baseTrajectory: PatternTrajectory = {
  leaderEndYear: 2027,
  followerEndYear: 2026,
  followerYearsElapsed: 63,
  patternLength: 64,
  terminatingEvent: {
    country: "South Korea",
    year: 2017,
    title: "Park impeachment and constitutional reform",
    category: "elections_and_voting",
    source: "https://example/kr-2017",
    dataEditorial: false,
  },
};

describe("PatternTrajectoryCell", () => {
  it("renders the narrative line with leader country, year, and event title", () => {
    render(
      <PatternTrajectoryCell trajectory={baseTrajectory} leaderCountry="South Korea" />
    );
    expect(screen.getByText(/South Korea window closed 2017/)).toBeInTheDocument();
    expect(screen.getByText(/Park impeachment/)).toBeInTheDocument();
  });

  it("renders the follower position label (Year X of Y)", () => {
    render(
      <PatternTrajectoryCell trajectory={baseTrajectory} leaderCountry="South Korea" />
    );
    expect(screen.getByText("Year 63 of 64")).toBeInTheDocument();
  });

  it("renders 'No verified event on record' (Ingrid honest framing) when terminatingEvent is null", () => {
    const trajectory: PatternTrajectory = {
      ...baseTrajectory,
      terminatingEvent: null,
    };
    render(<PatternTrajectoryCell trajectory={trajectory} leaderCountry="Brazil" />);
    expect(
      screen.getByText(/Brazil window closes ~2027 · No verified event on record/)
    ).toBeInTheDocument();
    // Must NOT use the word "pending" — Ingrid 2026-05-19.
    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
  });

  it("marks cell with data-editorial='true' and data-event-id when sourced editorially", () => {
    const trajectory: PatternTrajectory = {
      ...baseTrajectory,
      terminatingEvent: {
        ...baseTrajectory.terminatingEvent!,
        dataEditorial: true,
      },
    };
    const { container } = render(
      <PatternTrajectoryCell trajectory={trajectory} leaderCountry="South Korea" />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-editorial")).toBe("true");
    expect(root.getAttribute("data-event-id")).toBe("https://example/kr-2017");
  });

  it("marks cell with data-editorial='false' for algorithmic (Phase B) entries", () => {
    const { container } = render(
      <PatternTrajectoryCell trajectory={baseTrajectory} leaderCountry="South Korea" />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-editorial")).toBe("false");
  });

  it("truncates very long event titles with an ellipsis", () => {
    const trajectory: PatternTrajectory = {
      ...baseTrajectory,
      terminatingEvent: {
        ...baseTrajectory.terminatingEvent!,
        title:
          "An extraordinarily long event title that exceeds the scannable budget for an inline table cell and should be truncated",
      },
    };
    render(<PatternTrajectoryCell trajectory={trajectory} leaderCountry="South Korea" />);
    expect(screen.getByText(/…$/)).toBeInTheDocument();
  });

  it("renders position bar inner div width as percent of pattern progress", () => {
    const { container } = render(
      <PatternTrajectoryCell trajectory={baseTrajectory} leaderCountry="South Korea" />
    );
    const innerBar = container.querySelector('[role="presentation"] > div');
    expect(innerBar).not.toBeNull();
    expect((innerBar as HTMLElement).style.width).toBe("98%");
  });
});
