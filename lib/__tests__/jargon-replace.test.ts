import { describe, it, expect } from "vitest";
import { replaceJargonInProse } from "@/lib/jargon-replace";

describe("replaceJargonInProse — composite metric names (before bare-word)", () => {
  it("LOCO AUC → out-of-country score", () => {
    expect(replaceJargonInProse("LOCO AUC 0.722")).toBe("out-of-country score 0.722");
  });

  it("F2 AUC → in-sample score", () => {
    expect(replaceJargonInProse("F2 AUC 0.884")).toBe("in-sample score 0.884");
  });

  it("F1 AUC → in-sample score", () => {
    expect(replaceJargonInProse("F1 AUC 0.901")).toBe("in-sample score 0.901");
  });

  it("In-sample F1 → In-sample (capitalization preserved by regex i-flag)", () => {
    // The /gi flag rewrites the F1 token but doesn't alter case of
    // the preceding "In-sample" — that's a feature: prose stays naturally
    // capitalized at sentence start.
    expect(replaceJargonInProse("In-sample F1 ECE 0.04")).toBe(
      "In-sample calibration error 0.04"
    );
  });
});

describe("replaceJargonInProse — bare acronyms", () => {
  it("LOCO alone → out-of-country", () => {
    expect(replaceJargonInProse("trained on LOCO partition")).toBe(
      "trained on out-of-country partition"
    );
  });

  it("AUC alone → score", () => {
    expect(replaceJargonInProse("AUC 0.76")).toBe("score 0.76");
  });

  it("AHI → anchor stability", () => {
    expect(replaceJargonInProse("AHI value is 0.105")).toBe(
      "anchor stability value is 0.105"
    );
  });

  it("ECE → calibration error", () => {
    expect(replaceJargonInProse("ECE = 0.0061")).toBe("calibration error = 0.0061");
  });

  it("PPS → score", () => {
    expect(replaceJargonInProse("PPS quintiles")).toBe("score quintiles");
  });

  it("SCDI → cross-country indicator", () => {
    expect(replaceJargonInProse("an SCDI is a multi-country signal")).toBe(
      "an cross-country indicator is a multi-country signal"
    );
  });

  it("RCI → recipe confidence", () => {
    expect(replaceJargonInProse("RCI value")).toBe("recipe confidence value");
  });
});

describe("replaceJargonInProse — multi-word", () => {
  it("n_pos_LOCO → held-out positives", () => {
    expect(replaceJargonInProse("n_pos_LOCO = 7")).toBe("held-out positives = 7");
  });

  it("hybrid D2/D5 → hybrid prediction", () => {
    expect(replaceJargonInProse("the hybrid D2/D5 architecture")).toBe(
      "the hybrid prediction architecture"
    );
  });

  it("cohort_ece → tier calibration", () => {
    expect(replaceJargonInProse("the cohort_ece breakdown")).toBe(
      "the tier calibration breakdown"
    );
  });
});

describe("replaceJargonInProse — architecture with context", () => {
  it("D2 multi-task head → level-features model", () => {
    expect(replaceJargonInProse("The D2 multi-task head trained on indicators")).toBe(
      "The level-features model trained on indicators"
    );
  });

  it("D5 trajectory head → trend-features model", () => {
    expect(replaceJargonInProse("the D5 trajectory head")).toBe(
      "the trend-features model"
    );
  });

  it("D2 architecture → level-features model", () => {
    expect(replaceJargonInProse("under D2 architecture")).toBe(
      "under level-features model"
    );
  });
});

describe("replaceJargonInProse — internal citation drops", () => {
  it("drops (post-KI-2, 2026-05-11)", () => {
    expect(replaceJargonInProse("13 LOCKed recipes (post-KI-2, 2026-05-11)")).toBe(
      "13 validated recipes"
    );
  });

  it("drops bare (KI-2)", () => {
    expect(replaceJargonInProse("amendment (KI-2) applied")).toBe("amendment applied");
  });

  it("drops bare (F-H-3)", () => {
    expect(replaceJargonInProse("composite-only signal (F-H-3) applies")).toBe(
      "composite-only signal applies"
    );
  });

  it("rewrites 'Per Stage 5 §F-H-3 buyer-disclosure rule'", () => {
    expect(
      replaceJargonInProse("Per Stage 5 §F-H-3 buyer-disclosure rule, this recipe...")
    ).toBe("Per buyer-disclosure rule, this recipe...");
  });

  it("drops F-H-3 rule reference", () => {
    expect(replaceJargonInProse("violates the F-H-3 rule")).toBe("violates the");
  });
});

describe("replaceJargonInProse — markdown links to internal docs", () => {
  it("unlinks [label](../internal/...) to keep label only", () => {
    expect(
      replaceJargonInProse("See [per-recipe AHI analysis](../internal/ml-track.md).")
    ).toBe("See per-recipe anchor stability analysis.");
  });
});

describe("replaceJargonInProse — internal status words", () => {
  it("LOCKed → validated", () => {
    expect(replaceJargonInProse("the 14 LOCKed recipes")).toBe(
      "the 14 validated recipes"
    );
  });

  it("FALSIFIED → removed from production (bare D2 also rewritten)", () => {
    expect(replaceJargonInProse("Under D2, this recipe was FALSIFIED on F2.")).toBe(
      "Under level-features model, this recipe was removed from production on F2."
    );
  });
});

describe("replaceJargonInProse — Majles persona drops", () => {
  it("'per Sard Majles S-First (date)' → drops just the citation, prose preserved", () => {
    expect(
      replaceJargonInProse("Yuki's pick per Sard Majles S-First (2026-05-01) was...")
    ).toBe("Yuki's pick was...");
  });

  it("'Sard Majles' alone → drops + whitespace cleanup collapses adjacent comma", () => {
    expect(replaceJargonInProse("Per Sard Majles, the decision was...")).toBe(
      "Per, the decision was..."
    );
  });

  it("bare 'Majles cycle' → 'review cycle'", () => {
    expect(replaceJargonInProse("deferred to future Majles cycle")).toBe(
      "deferred to future review cycle"
    );
  });
});

describe("replaceJargonInProse — whitespace cleanup", () => {
  it("collapses double spaces from drops", () => {
    expect(replaceJargonInProse("foo  bar   baz")).toBe("foo bar baz");
  });

  it("strips empty parens left by drops", () => {
    // simulate after a drop: "context (  )"
    expect(replaceJargonInProse("context (  )")).toBe("context");
  });

  it("strips space before punctuation", () => {
    expect(replaceJargonInProse("end of sentence .")).toBe("end of sentence.");
  });
});

describe("replaceJargonInProse — passthrough", () => {
  it("returns clean prose unchanged", () => {
    const clean = "Civil war and insurgency predicts active-conflict onset.";
    expect(replaceJargonInProse(clean)).toBe(clean);
  });

  it("empty input → empty", () => {
    expect(replaceJargonInProse("")).toBe("");
  });
});
