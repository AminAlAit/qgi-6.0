import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignalsV2Detail } from "./SignalsV2Detail";
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
    mechanism_narrative: "Active-conflict onset signature.",
    mechanism_narrative_excerpt: "Active-conflict onset signature.",
    buyer_disclosure_recommendation: "test",
    open_followups: [],
    paper_section_anchor: "section-4-civil_war_and_insurgency",
    top_k_indicators: [],
    model_version: "v1.0",
    ...overrides,
  };
}

function makeRecipe(overrides: Partial<MlRecipeEntry> = {}): BuyerMlRecipe {
  return toBuyerView(makeRawRecipe(overrides));
}

describe("SignalsV2Detail", () => {
  const baseProps = {
    recipe: makeRecipe(),
    country: "Syria",
    countryAlpha2: "SY",
    countrySlugStr: "syria",
    topRecipes: [
      makeRecipe(),
      makeRecipe({
        recipe_id: "multilateral_agreement",
        display_name: "Multilateral agreement",
        tier: "STRONG" as const,
      }),
      makeRecipe({
        recipe_id: "elections_and_voting",
        display_name: "Elections and voting",
        tier: "MODERATE" as const,
      }),
      makeRecipe({
        recipe_id: "bilateral_treaty",
        display_name: "Bilateral treaty",
        tier: "MODERATE" as const,
      }),
    ],
    caveatStyle: "tufte" as const,
    generatedAt: "2026-05-12",
    paperHref: "https://example.com/paper",
  };

  it("renders the recipe display_name as h1", () => {
    render(<SignalsV2Detail {...baseProps} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Civil war and insurgency"
    );
  });

  it("renders the country in the header context", () => {
    render(<SignalsV2Detail {...baseProps} />);
    expect(screen.getByText(/Signal context — Syria/)).toBeInTheDocument();
  });

  it("renders the country in the breadcrumb with the slug parenthetical", () => {
    render(<SignalsV2Detail {...baseProps} />);
    const breadcrumb = screen.getByTestId("country-context");
    expect(breadcrumb.textContent).toBe("Syria (syria)");
  });

  it("renders the MVP-shallow disclosure", () => {
    render(<SignalsV2Detail {...baseProps} />);
    const disclosure = screen.getByTestId("mvp-disclosure");
    expect(disclosure.textContent).toMatch(/not yet baked/);
    expect(disclosure.textContent).toMatch(/Syria/);
  });

  it("renders the recipe-switcher with the OTHER 3 top recipes (not the current one)", () => {
    render(<SignalsV2Detail {...baseProps} />);
    const switcher = screen.getByTestId("recipe-switcher");
    expect(switcher.children).toHaveLength(3);
    expect(switcher.textContent).toContain("Multilateral agreement");
    expect(switcher.textContent).toContain("Elections and voting");
    expect(switcher.textContent).toContain("Bilateral treaty");
    expect(switcher.textContent).not.toContain("Civil war and insurgency");
  });

  it("recipe-switcher links go to the same (country, otherRecipe) on Tufte", () => {
    render(<SignalsV2Detail {...baseProps} />);
    const switcher = screen.getByTestId("recipe-switcher");
    const links = Array.from(switcher.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    );
    expect(links).toContain("/signals-v2-a/syria/multilateral_agreement");
    expect(links).toContain("/signals-v2-a/syria/bilateral_treaty");
  });

  it("recipe-switcher links go to /signals-v2-b/... on Lloyd's", () => {
    render(<SignalsV2Detail {...baseProps} caveatStyle="lloyds" />);
    const switcher = screen.getByTestId("recipe-switcher");
    const link = switcher.querySelector("a");
    expect(link?.getAttribute("href")).toMatch(/^\/signals-v2-b\/syria\//);
  });

  it("renders metric grid", () => {
    render(<SignalsV2Detail {...baseProps} />);
    expect(screen.getByText("0.7686")).toBeInTheDocument();
    expect(screen.getByText("0.8840")).toBeInTheDocument();
  });

  it("renders Anchor AHI value when measured", () => {
    render(<SignalsV2Detail {...baseProps} />);
    expect(screen.getByText("0.1052")).toBeInTheDocument();
  });

  it("renders 'Not measured' hint when AHI is null", () => {
    render(
      <SignalsV2Detail
        {...baseProps}
        recipe={makeRecipe({
          anchor_ahi_value: null,
          anchor_ahi_status: "not_measured",
          anchor_ahi_reason: "Not measured — no anchor cases",
        })}
      />
    );
    expect(screen.getByText("Not measured")).toBeInTheDocument();
  });

  it("provides the cross-style variant switch link", () => {
    render(<SignalsV2Detail {...baseProps} caveatStyle="tufte" />);
    const link = screen.getByText(/Switch to banner view/);
    expect(link.closest("a")?.getAttribute("href")).toBe(
      "/signals-v2-b/syria/civil_war_and_insurgency"
    );
  });
});
