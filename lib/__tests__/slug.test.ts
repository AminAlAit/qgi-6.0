import { describe, it, expect } from "vitest";
import { countrySlug, curatedEventsSlug } from "@/lib/slug";

describe("countrySlug", () => {
  it("lowercases simple names", () => {
    expect(countrySlug("France")).toBe("france");
  });

  it("replaces spaces with underscores", () => {
    expect(countrySlug("United States")).toBe("united_states");
  });

  it("treats apostrophes as token separators (not delete-chars)", () => {
    // #422 Bug 4: must be "cote_d_ivoire", not "cote_divoire"
    expect(countrySlug("Cote d'Ivoire")).toBe("cote_d_ivoire");
  });

  it("transliterates Latin-1 diacritics to ASCII (#470 item 5)", () => {
    // Without NFKD normalization these would lose the accented char
    // entirely (Côte → c_te, São → s_o), breaking the sitemap +
    // 308-redirect path for the 4 countries with non-ASCII names.
    expect(countrySlug("Côte d'Ivoire")).toBe("cote_d_ivoire");
    expect(countrySlug("São Tomé and Príncipe")).toBe("sao_tome_and_principe");
    expect(countrySlug("Türkiye")).toBe("turkiye");
    expect(countrySlug("Curaçao")).toBe("curacao");
  });

  it("treats periods as token separators", () => {
    expect(countrySlug("U.S.A.")).toBe("u_s_a");
  });

  it("removes commas without producing double underscores", () => {
    expect(countrySlug("Korea, South")).toBe("korea_south");
  });

  it("rewrites ampersand to 'and'", () => {
    expect(countrySlug("Bosnia & Herzegovina")).toBe("bosnia_and_herzegovina");
  });

  it("strips leading/trailing underscores", () => {
    expect(countrySlug("-Libya-")?.startsWith("_")).toBe(false);
    expect(countrySlug("-Libya-")?.endsWith("_")).toBe(false);
  });

  it("returns null on null/undefined/empty", () => {
    expect(countrySlug(null)).toBeNull();
    expect(countrySlug(undefined)).toBeNull();
    expect(countrySlug("")).toBeNull();
  });

  it("collapses adjacent separators to a single underscore", () => {
    expect(countrySlug("St.'Foo")).toBe("st_foo");
  });

  it("returns curated-set canonicals for themselves", () => {
    // These slugs are curated-events filenames; countrySlug must produce them verbatim.
    expect(countrySlug("china")).toBe("china");
    expect(countrySlug("South Korea")).toBe("south_korea");
    expect(countrySlug("Sao Tome and Principe")).toBe("sao_tome_and_principe");
  });

  // #470 item 5: this previously asserted the OLD bug-as-feature
  // ("Côte" → "c_te" because the é was stripped). Updated to assert
  // the new (correct) transliteration behavior — covered above by the
  // "transliterates Latin-1 diacritics to ASCII" test, but kept this
  // case for parity with its pre-#470 form.
  it("non-ASCII chars are transliterated, not stripped", () => {
    expect(countrySlug("Côte")).toBe("cote");
  });
});

describe("curatedEventsSlug", () => {
  it("strips leading 'the'", () => {
    expect(curatedEventsSlug("The Bahamas")).toBe("bahamas");
  });

  it("collapses 'of the' to 'of'", () => {
    expect(curatedEventsSlug("Democratic Republic of the Congo")).toBe(
      "democratic_republic_of_congo"
    );
  });

  it("lowercases + underscores", () => {
    expect(curatedEventsSlug("Sao Tome and Principe")).toBe("sao_tome_and_principe");
  });

  it("returns null on null/undefined/empty", () => {
    expect(curatedEventsSlug(null)).toBeNull();
    expect(curatedEventsSlug(undefined)).toBeNull();
    expect(curatedEventsSlug("")).toBeNull();
  });
});
