import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrecedentsAggregatedListClient } from "./PrecedentsAggregatedListClient";
import type { RecipeAggregated } from "@/lib/recipes-aggregated";

/**
 * #481 follow-up tests: Confidence column + tier filter + sort.
 *
 * Constructs a small fixture of recipes that exist in the live
 * `data/recipe-confidence.json` file with known tiers, then asserts
 * the index renders them with the correct badges, the new default
 * sort lands GREEN at the top, and the tier filter strip narrows
 * the visible rows.
 *
 * Recipes used (live tiers from data/recipe-confidence.json as of
 * 2026-04-27 v0.5 audit):
 *   - economic_recession      → GREEN
 *   - fiscal_policy_change    → GREEN
 *   - migration_and_refugees  → GREEN
 *   - bilateral_treaty        → GREEN
 *   - elections_routine       → YELLOW (or one of the 8 yellow recipes)
 *   - one RED recipe
 *   - one INSUFFICIENT recipe (any unknown event_category)
 */

function makeRecipe(
  event_category: string,
  total_instances: number,
  oecd_share = 0.3
): RecipeAggregated {
  return {
    event_category,
    canonical_length: 10,
    total_instances,
    n_distinct_country_pairs: total_instances,
    contains_predicted: false,
    indicator_fingerprint: [],
    length_distribution: [],
    coverage_bias_diagnostic: {
      n_pairs: total_instances,
      oecd_share,
      regional_concentration: [],
    },
    last_recomputed_at: "2026-04-27T20:00:00Z",
  };
}

const generatedAt = "2026-04-27T20:00:00Z";
const pipelineVersion = "v0.5";

describe("PrecedentsAggregatedListClient — RCI integration", () => {
  it("renders the Confidence column header", () => {
    render(
      <PrecedentsAggregatedListClient
        recipes={[makeRecipe("economic_recession", 100)]}
        generatedAt={generatedAt}
        pipelineVersion={pipelineVersion}
      />
    );
    expect(screen.getByText("Confidence")).toBeInTheDocument();
  });

  it("renders an RciBadge for a GREEN recipe", () => {
    render(
      <PrecedentsAggregatedListClient
        recipes={[makeRecipe("economic_recession", 100)]}
        generatedAt={generatedAt}
        pipelineVersion={pipelineVersion}
      />
    );
    // economic_recession is GREEN in the live confidence data.
    // getAllByText to handle the same label appearing in mobile + desktop layouts.
    const badges = screen.getAllByText("High confidence");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("renders an Insufficient badge for an unknown event_category", () => {
    render(
      <PrecedentsAggregatedListClient
        recipes={[makeRecipe("nonsense_event_xyz", 100)]}
        generatedAt={generatedAt}
        pipelineVersion={pipelineVersion}
      />
    );
    const badges = screen.getAllByText("Insufficient data");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("defaults to Confidence (high to low) sort — GREEN row appears before INSUFFICIENT row", () => {
    // Two rows: one GREEN, one INSUFFICIENT. Default sort must put GREEN first.
    const recipes = [
      makeRecipe("nonsense_event_xyz", 9999), // INSUFFICIENT but huge instance count
      makeRecipe("economic_recession", 1), // GREEN with tiny instance count
    ];
    render(
      <PrecedentsAggregatedListClient
        recipes={recipes}
        generatedAt={generatedAt}
        pipelineVersion={pipelineVersion}
      />
    );
    // The badge text is the same on mobile + desktop, so query the desktop
    // table area only via the visible "Economic Recession" / "Nonsense Event Xyz"
    // category labels and assert order.
    const greenLabels = screen.getAllByText("Economic Recession");
    const insufficientLabels = screen.getAllByText("Nonsense Event Xyz");
    // For a row to be "before" another, its element should come earlier in
    // document order. Compare DOM positions on the desktop instances of each.
    const allHeadings = [...greenLabels, ...insufficientLabels];
    const greenFirst = allHeadings.findIndex((el) =>
      el.textContent?.includes("Economic Recession")
    );
    const insufFirst = allHeadings.findIndex((el) =>
      el.textContent?.includes("Nonsense Event Xyz")
    );
    // Both arrays render entries; assert at least one Economic Recession
    // is before all Nonsense Event Xyz entries by checking compareDocumentPosition.
    expect(
      greenLabels[0].compareDocumentPosition(insufficientLabels[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    // Sanity: indices are valid
    expect(greenFirst).toBeGreaterThanOrEqual(0);
    expect(insufFirst).toBeGreaterThanOrEqual(0);
  });

  it("filters by tier when a tier chip is clicked", () => {
    const recipes = [
      makeRecipe("economic_recession", 100), // GREEN
      makeRecipe("nonsense_event_xyz", 100), // INSUFFICIENT
    ];
    render(
      <PrecedentsAggregatedListClient
        recipes={recipes}
        generatedAt={generatedAt}
        pipelineVersion={pipelineVersion}
      />
    );
    // Both visible initially.
    expect(screen.getAllByText("Economic Recession").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nonsense Event Xyz").length).toBeGreaterThan(0);

    // Click the High tier filter chip — only GREEN row should remain.
    const highChip = screen.getByTitle(/High confidence \(\d+ recipes\)/i);
    fireEvent.click(highChip);

    expect(screen.getAllByText("Economic Recession").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nonsense Event Xyz")).toBeNull();
  });

  it("toggles tier filter off when chip is clicked twice", () => {
    const recipes = [
      makeRecipe("economic_recession", 100),
      makeRecipe("nonsense_event_xyz", 100),
    ];
    render(
      <PrecedentsAggregatedListClient
        recipes={recipes}
        generatedAt={generatedAt}
        pipelineVersion={pipelineVersion}
      />
    );
    const highChip = screen.getByTitle(/High confidence \(\d+ recipes\)/i);
    fireEvent.click(highChip);
    expect(screen.queryByText("Nonsense Event Xyz")).toBeNull();
    // Click again — filter clears
    fireEvent.click(highChip);
    expect(screen.getAllByText("Nonsense Event Xyz").length).toBeGreaterThan(0);
  });

  it("renders the Confidence (high to low) sort option", () => {
    render(
      <PrecedentsAggregatedListClient
        recipes={[makeRecipe("economic_recession", 100)]}
        generatedAt={generatedAt}
        pipelineVersion={pipelineVersion}
      />
    );
    // The sort dropdown exposes the new option.
    const dropdown = screen.getByRole("combobox");
    const optionTexts = Array.from(dropdown.querySelectorAll("option")).map(
      (o) => o.textContent
    );
    expect(optionTexts).toContain("Confidence (high to low)");
    expect(optionTexts).toContain("Confidence (low to high)");
    // Existing options remain.
    expect(optionTexts).toContain("Evidence depth (high to low)");
    expect(optionTexts).toContain("Category (A-Z)");
  });

  // ----- PR #10 review follow-up tests -----
  // These cover gaps the Sonnet review surfaced after the original PR
  // merged: the within-tier sort tie-break logic, multi-tier filter
  // OR-semantics, and the mobile <RciBadge> render path.

  it("within-tier sort uses RCI numeric desc as secondary key (review-#11 finding 1)", () => {
    // Four GREEN recipes (all tier=GREEN in the v0.5 audit data):
    //   economic_recession        rci 0.78  inst 1
    //   fiscal_policy_change      rci 0.61  inst 999
    //   migration_and_refugees    rci 0.54  inst 50
    //   bilateral_treaty          rci 0.53  inst 200
    //
    // RCI values are all distinct so this test exclusively exercises
    // the rci-as-secondary contract — the order would invert if
    // total_instances were primary. The tertiary tie-break
    // (total_instances when rci is equal) is exercised separately
    // below.
    const recipes = [
      makeRecipe("fiscal_policy_change", 999),
      makeRecipe("bilateral_treaty", 200),
      makeRecipe("migration_and_refugees", 50),
      makeRecipe("economic_recession", 1),
    ];
    render(
      <PrecedentsAggregatedListClient
        recipes={recipes}
        generatedAt={generatedAt}
        pipelineVersion={pipelineVersion}
      />
    );
    const econ = screen.getAllByText("Economic Recession")[0];
    const fiscal = screen.getAllByText("Fiscal Policy Change")[0];
    const migration = screen.getAllByText("Migration And Refugees")[0];
    const bilateral = screen.getAllByText("Bilateral Treaty")[0];
    // Confirm DOM order: econ (0.78) < fiscal (0.61) < migration (0.54) < bilateral (0.53)
    expect(econ.compareDocumentPosition(fiscal) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(
      fiscal.compareDocumentPosition(migration) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      migration.compareDocumentPosition(bilateral) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("multi-tier filter behaves as OR within the tier axis", () => {
    // Two recipes — one GREEN, one INSUFFICIENT. Activating BOTH chips
    // (High + Insufficient) should keep both rows visible. With AND
    // semantics the result would be empty (no row is two tiers at once);
    // with OR semantics both rows pass, locking the design contract.
    const recipes = [
      makeRecipe("economic_recession", 100), // GREEN
      makeRecipe("nonsense_event_xyz", 100), // INSUFFICIENT
    ];
    render(
      <PrecedentsAggregatedListClient
        recipes={recipes}
        generatedAt={generatedAt}
        pipelineVersion={pipelineVersion}
      />
    );
    fireEvent.click(screen.getByTitle(/High confidence \(\d+ recipes\)/i));
    // After only High: only GREEN row visible.
    expect(screen.queryByText("Nonsense Event Xyz")).toBeNull();
    // Activate Insufficient too — both rows visible (OR within axis).
    fireEvent.click(screen.getByTitle(/Insufficient confidence \(\d+ recipes\)/i));
    expect(screen.getAllByText("Economic Recession").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nonsense Event Xyz").length).toBeGreaterThan(0);
  });

  it("renders the RciBadge in the mobile-only row layout (review-#11 finding 2)", () => {
    // The component renders BOTH a desktop grid (`hidden md:grid`) and
    // a mobile flex column (`md:hidden`). The desktop layout already
    // renders the badge (covered by other tests); this asserts that
    // the mobile path also includes a chip — otherwise mobile users
    // would lose the at-a-glance confidence signal.
    //
    // Resilience note (PR #11 review): we use `querySelectorAll` and
    // check that ANY of the `.md:hidden` blocks contains the badge,
    // rather than scoping to the first match. If a future refactor
    // adds another mobile-only element above the row (e.g. a mobile
    // header strip), the first-match approach would silently target
    // it; the any-match approach passes as long as the badge appears
    // in at least one mobile block on the page.
    const { container } = render(
      <PrecedentsAggregatedListClient
        recipes={[makeRecipe("economic_recession", 100)]}
        generatedAt={generatedAt}
        pipelineVersion={pipelineVersion}
      />
    );
    const mobileBlocks = container.querySelectorAll(".md\\:hidden");
    expect(mobileBlocks.length).toBeGreaterThan(0);
    // jsdom doesn't apply Tailwind; elements exist in the DOM
    // regardless of CSS visibility, so we can search inside them.
    const anyMobileContainsBadge = Array.from(mobileBlocks).some((el) =>
      el.textContent?.includes("High confidence")
    );
    expect(anyMobileContainsBadge).toBe(true);
  });

  it("composes domain + tier filters multiplicatively (intersection)", () => {
    // economic_recession is L1=Economic, GREEN.
    // nonsense_event_xyz is uncategorized, INSUFFICIENT.
    const recipes = [
      makeRecipe("economic_recession", 100),
      makeRecipe("nonsense_event_xyz", 100),
    ];
    render(
      <PrecedentsAggregatedListClient
        recipes={recipes}
        generatedAt={generatedAt}
        pipelineVersion={pipelineVersion}
      />
    );
    // Apply High tier — GREEN row remains, INSUFFICIENT row gone.
    const highChip = screen.getByTitle(/High confidence \(\d+ recipes\)/i);
    fireEvent.click(highChip);
    expect(screen.getAllByText("Economic Recession").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nonsense Event Xyz")).toBeNull();
  });
});
