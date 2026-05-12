import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrecedentsV2List } from "./PrecedentsV2List";
import type { MlRecipeEntry } from "@/lib/recipes-ml";
import { toBuyerView, type BuyerMlRecipe } from "@/lib/buyer-view";

function makeRawRecipe(overrides: Partial<MlRecipeEntry> = {}): MlRecipeEntry {
  return {
    recipe_id: "civil_war_and_insurgency",
    display_name: "Civil war and insurgency",
    tier: "STRONG",
    architecture: "D2",
    loco_auc: 0.7686,
    n_pos_loco: 7,
    assignment_confidence: "MODERATE",
    in_sample_f1_ece: 0.0061,
    in_sample_f2_auc: 0.884,
    in_sample_f2_ci_lower: 0.794,
    in_sample_f2_ci_upper: 0.942,
    ece_overall: 0.0061,
    ece_high_cohort: 0.0068,
    ece_mid_cohort: 0.0118,
    ece_low_cohort: 0.0023,
    zero_positive_cohort_flag: null,
    anchor_ahi_value: 0.1052,
    anchor_ahi_status: "measured",
    anchor_ahi_n_evaluable: null,
    anchor_ahi_reason: null,
    advisory_only_flag: false,
    f_rule_anomaly_flag: false,
    top_1_training_country: "syria",
    top_1_training_country_share: 0.222,
    concentration_alert_level: "caution",
    interpretation_hint: "risk_elevation",
    mechanism_narrative: "Test mechanism narrative for unit test.",
    mechanism_narrative_excerpt: "Test mechanism narrative for unit test.",
    buyer_disclosure_recommendation: "Test disclosure.",
    open_followups: [],
    paper_section_anchor: "section-4-civil_war_and_insurgency",
    top_k_indicators: [],
    model_version: "v1.0-abc1234 (2026-05-11)",
    ...overrides,
  };
}

function makeRecipe(overrides: Partial<MlRecipeEntry> = {}): BuyerMlRecipe {
  return toBuyerView(makeRawRecipe(overrides));
}

describe("PrecedentsV2List", () => {
  it("renders 4 recipes in tier order STRONG -> MODERATE -> MARGINAL", () => {
    const recipes = [
      makeRecipe({ recipe_id: "bilateral_treaty", tier: "MODERATE" }),
      makeRecipe({ recipe_id: "civil_war_and_insurgency", tier: "STRONG" }),
      makeRecipe({ recipe_id: "elections_and_voting", tier: "MODERATE" }),
      makeRecipe({ recipe_id: "multilateral_agreement", tier: "STRONG" }),
    ];
    render(
      <PrecedentsV2List
        recipes={recipes}
        caveatStyle="tufte"
        generatedAt="2026-05-11T16:00:00Z"
        modelVersion="v1.0"
        totalLocked={13}
      />
    );
    const list = screen.getByTestId("recipe-list");
    // First two children should be STRONG-tier
    const tiers = Array.from(list.querySelectorAll("a")).map(
      (a) => a.querySelector("span")?.textContent
    );
    expect(tiers[0]).toBe("STRONG");
    expect(tiers[1]).toBe("STRONG");
    expect(tiers[2]).toBe("MODERATE");
    expect(tiers[3]).toBe("MODERATE");
  });

  it("renders cross-link to Lloyd's variant on Tufte page", () => {
    render(
      <PrecedentsV2List
        recipes={[makeRecipe()]}
        caveatStyle="tufte"
        generatedAt="2026-05-11"
        modelVersion="v1.0"
        totalLocked={13}
      />
    );
    expect(screen.getByText("Banner view →")).toBeInTheDocument();
  });

  it("renders cross-link to Tufte variant on Lloyd's page", () => {
    render(
      <PrecedentsV2List
        recipes={[makeRecipe()]}
        caveatStyle="lloyds"
        generatedAt="2026-05-11"
        modelVersion="v1.0"
        totalLocked={13}
      />
    );
    expect(screen.getByText("Compact view →")).toBeInTheDocument();
  });

  it("shows composite-only label when advisory-only flag is set", () => {
    render(
      <PrecedentsV2List
        recipes={[
          makeRecipe({ advisory_only_flag: true, recipe_id: "terrorist_attack" }),
        ]}
        caveatStyle="tufte"
        generatedAt="2026-05-11"
        modelVersion="v1.0"
        totalLocked={13}
      />
    );
    expect(screen.getByText("Composite-only")).toBeInTheDocument();
  });

  it("renders generated_at and model_version in footer", () => {
    render(
      <PrecedentsV2List
        recipes={[makeRecipe()]}
        caveatStyle="tufte"
        generatedAt="2026-05-11T16:00:00Z"
        modelVersion="v1.0-abc1234 (2026-05-11)"
        totalLocked={13}
      />
    );
    // Footer text is split across multiple StaticText siblings; check by
    // joining textContent of the footer paragraph.
    const footer = document.querySelector("footer");
    expect(footer?.textContent).toContain("2026-05-11T16:00:00Z");
    expect(footer?.textContent).toContain("v1.0-abc1234 (2026-05-11)");
  });

  it("renders 'of 13 validated' with correct whitespace", () => {
    // Regression test for JSX whitespace-collapse bug ("4of 13" vs "4 of 13")
    render(
      <PrecedentsV2List
        recipes={[makeRecipe(), makeRecipe({ recipe_id: "x" })]}
        caveatStyle="tufte"
        generatedAt="2026-05-11"
        modelVersion="v1.0"
        totalLocked={13}
      />
    );
    const paragraph = screen.getByText(/validated recipes from the hybrid/);
    expect(paragraph.textContent).toMatch(/\(2 of 13 validated/);
    expect(paragraph.textContent).not.toMatch(/\(2of 13/);
  });
});
