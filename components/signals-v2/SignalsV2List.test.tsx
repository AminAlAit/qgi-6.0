import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignalsV2List } from "./SignalsV2List";
import type { CountryRisk } from "@/lib/country-risks.schema";
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
    mechanism_narrative: "test",
    mechanism_narrative_excerpt: "test",
    buyer_disclosure_recommendation: "test",
    open_followups: [],
    paper_section_anchor: "section-4-x",
    top_k_indicators: [],
    model_version: "v1.0",
    ...overrides,
  };
}

function makeRecipe(overrides: Partial<MlRecipeEntry> = {}): BuyerMlRecipe {
  return toBuyerView(makeRawRecipe(overrides));
}

function makeCountry(overrides: Partial<{ id: string } & CountryRisk> = {}): {
  id: string;
} & CountryRisk {
  return {
    id: "1",
    name: "Syria",
    alpha_2: "SY",
    curated: true,
    overall_risk_tier: "HIGH",
    tiers: {
      S: { top_categories: [] },
      M: { top_categories: [] },
      L: { top_categories: [] },
      XL: { top_categories: [] },
    },
    ...overrides,
  };
}

describe("SignalsV2List", () => {
  it("renders one card per country in the grid", () => {
    render(
      <SignalsV2List
        countries={[
          makeCountry({ id: "1", name: "Syria" }),
          makeCountry({ id: "2", name: "Germany", overall_risk_tier: "INDICATIVE" }),
          makeCountry({ id: "3", name: "Yemen", overall_risk_tier: "HIGH" }),
        ]}
        topRecipes={[makeRecipe()]}
        caveatStyle="tufte"
        generatedAt="2026-05-12T00:00:00Z"
        modelVersion="v1.0"
        defaultRecipeSlug="civil_war_and_insurgency"
      />
    );
    const grid = screen.getByTestId("country-grid");
    expect(grid.children).toHaveLength(3);
  });

  it("country card link goes to /signals-v2-a/{slug}/{defaultRecipe}", () => {
    render(
      <SignalsV2List
        countries={[makeCountry({ id: "1", name: "Syria" })]}
        topRecipes={[makeRecipe()]}
        caveatStyle="tufte"
        generatedAt="2026-05-12"
        modelVersion="v1.0"
        defaultRecipeSlug="civil_war_and_insurgency"
      />
    );
    const grid = screen.getByTestId("country-grid");
    const link = grid.querySelector("a");
    expect(link?.getAttribute("href")).toBe(
      "/signals-v2-a/syria/civil_war_and_insurgency"
    );
  });

  it("country card link goes to /signals-v2-b/... for Lloyd's variant", () => {
    render(
      <SignalsV2List
        countries={[makeCountry({ id: "1", name: "Germany" })]}
        topRecipes={[makeRecipe()]}
        caveatStyle="lloyds"
        generatedAt="2026-05-12"
        modelVersion="v1.0"
        defaultRecipeSlug="bilateral_treaty"
      />
    );
    const grid = screen.getByTestId("country-grid");
    const link = grid.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/signals-v2-b/germany/bilateral_treaty");
  });

  it("renders the variant cross-link", () => {
    render(
      <SignalsV2List
        countries={[]}
        topRecipes={[makeRecipe()]}
        caveatStyle="tufte"
        generatedAt="2026-05-12"
        modelVersion="v1.0"
        defaultRecipeSlug="civil_war_and_insurgency"
      />
    );
    expect(screen.getByText("Banner view →")).toBeInTheDocument();
  });
});
