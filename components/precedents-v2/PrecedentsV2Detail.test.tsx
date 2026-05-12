import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrecedentsV2Detail } from "./PrecedentsV2Detail";
import type { MlRecipeEntry } from "@/lib/recipes-ml";
import { toBuyerView, type BuyerMlRecipe } from "@/lib/buyer-view";

/** Build a raw `MlRecipeEntry` fixture. */
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
    buyer_disclosure_recommendation: "**Pricing-grade** — flagship LOCK.",
    open_followups: [],
    paper_section_anchor: "section-4-civil_war_and_insurgency",
    top_k_indicators: [
      {
        rank: 1,
        indicator_id: "VC.BTL.DETH__diff",
        mean_abs_shap: 0.55,
        fixed_effect_suspect: false,
      },
      {
        rank: 2,
        indicator_id: "PV.EST__diff",
        mean_abs_shap: 0.39,
        fixed_effect_suspect: true,
      },
    ],
    model_version: "v1.0-abc1234 (2026-05-11)",
    ...overrides,
  };
}

/**
 * Convenience: build a raw fixture and pass it through `toBuyerView` so
 * tests exercise the actual production code path. The buyer-view
 * transform cleans prose / shapes indicators / relabels architecture.
 */
function makeRecipe(overrides: Partial<MlRecipeEntry> = {}): BuyerMlRecipe {
  return toBuyerView(makeRawRecipe(overrides));
}

describe("PrecedentsV2Detail", () => {
  it("renders the display_name as the page header", () => {
    render(
      <PrecedentsV2Detail
        recipe={makeRecipe()}
        caveatStyle="tufte"
        generatedAt="2026-05-11"
        paperHref="https://example.com/paper"
      />
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Civil war and insurgency"
    );
  });

  it("renders the metric grid with out-of-country + in-sample + calibration values", () => {
    render(
      <PrecedentsV2Detail
        recipe={makeRecipe()}
        caveatStyle="tufte"
        generatedAt="2026-05-11"
        paperHref="https://example.com/paper"
      />
    );
    expect(screen.getByText("0.7686")).toBeInTheDocument();
    expect(screen.getByText("0.8840")).toBeInTheDocument();
    expect(screen.getByText("95% CI [0.794, 0.942]")).toBeInTheDocument();
  });

  it("renders concentration caveat when share is in caution range", () => {
    render(
      <PrecedentsV2Detail
        recipe={makeRecipe()}
        caveatStyle="tufte"
        generatedAt="2026-05-11"
        paperHref="https://example.com/paper"
      />
    );
    const block = screen.getByTestId("critical-disclosures");
    // Concentration caveat text is fragmented across multiple StaticText
    // nodes; check by joining textContent.
    expect(block.textContent).toMatch(/syria/);
    expect(block.textContent).toMatch(/22\.2/);
  });

  it("renders 'Not measured' hint when AHI is null", () => {
    render(
      <PrecedentsV2Detail
        recipe={makeRecipe({
          anchor_ahi_value: null,
          anchor_ahi_status: "not_measured",
          anchor_ahi_reason: "Not measured — no anchor cases in suite",
        })}
        caveatStyle="tufte"
        generatedAt="2026-05-11"
        paperHref="https://example.com/paper"
      />
    );
    expect(screen.getByText("Not measured")).toBeInTheDocument();
  });

  it("renders measured AHI as a numeric value", () => {
    render(
      <PrecedentsV2Detail
        recipe={makeRecipe()}
        caveatStyle="tufte"
        generatedAt="2026-05-11"
        paperHref="https://example.com/paper"
      />
    );
    expect(screen.getByText("0.1052")).toBeInTheDocument();
  });

  it("renders composite-only callout when advisory-only flag is set", () => {
    render(
      <PrecedentsV2Detail
        recipe={makeRecipe({ advisory_only_flag: true, n_pos_loco: 1 })}
        caveatStyle="lloyds"
        generatedAt="2026-05-11"
        paperHref="https://example.com/paper"
      />
    );
    expect(screen.getByText("Composite-only signal")).toBeInTheDocument();
  });

  it("renders F-rule anomaly callout when flag is set", () => {
    render(
      <PrecedentsV2Detail
        recipe={makeRecipe({ f_rule_anomaly_flag: true })}
        caveatStyle="lloyds"
        generatedAt="2026-05-11"
        paperHref="https://example.com/paper"
      />
    );
    expect(screen.getByText("F-rule anomaly")).toBeInTheDocument();
  });

  it("parses markdown bold in buyer_disclosure_recommendation", () => {
    render(
      <PrecedentsV2Detail
        recipe={makeRecipe()}
        caveatStyle="tufte"
        generatedAt="2026-05-11"
        paperHref="https://example.com/paper"
      />
    );
    // **Pricing-grade** should render as <strong>Pricing-grade</strong>, not raw asterisks
    const strong = screen.getByText("Pricing-grade");
    expect(strong.tagName).toBe("STRONG");
    // Raw asterisks should not appear in any p tag
    const paragraphs = document.querySelectorAll("p");
    for (const p of Array.from(paragraphs)) {
      expect(p.textContent).not.toContain("**Pricing-grade**");
    }
  });

  it("renders indicator table with friendly labels + country-bias note", () => {
    render(
      <PrecedentsV2Detail
        recipe={makeRecipe()}
        caveatStyle="tufte"
        generatedAt="2026-05-11"
        paperHref="https://example.com/paper"
      />
    );
    // Indicator IDs rendered as friendly labels via buyer-view transform.
    expect(
      screen.getByText("Battle-related deaths (number of people) (year-over-year change)")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Political Stability and Absence of Violence/Terrorism (estimate) (year-over-year change)"
      )
    ).toBeInTheDocument();
    // Raw IDs must NOT appear as visible text.
    expect(screen.queryByText("VC.BTL.DETH__diff")).not.toBeInTheDocument();
    expect(screen.queryByText("PV.EST__diff")).not.toBeInTheDocument();
    // Fixed-effect translated to buyer-facing caveat.
    expect(screen.getByText("Possible country bias")).toBeInTheDocument();
    expect(screen.queryByText("fixed-effect suspect")).not.toBeInTheDocument();
  });

  it("includes the model_version in footer", () => {
    render(
      <PrecedentsV2Detail
        recipe={makeRecipe()}
        caveatStyle="tufte"
        generatedAt="2026-05-11"
        paperHref="https://example.com/paper"
      />
    );
    expect(screen.getByText("v1.0-abc1234 (2026-05-11)")).toBeInTheDocument();
  });

  it("provides methodology paper anchor link", () => {
    render(
      <PrecedentsV2Detail
        recipe={makeRecipe()}
        caveatStyle="tufte"
        generatedAt="2026-05-11"
        paperHref="https://example.com/paper#section-4-civil_war_and_insurgency"
      />
    );
    const link = screen.getByText(/Open paper/);
    expect(link.closest("a")?.getAttribute("href")).toContain(
      "section-4-civil_war_and_insurgency"
    );
  });
});
