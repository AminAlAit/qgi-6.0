/**
 * #426 regression guard + #426 happy-path neighborhood coverage.
 *
 * Bug that was fixed (#426):
 *   - /countries/syria rendered a 200 placeholder titled "Country #syria"
 *     (input reflected into title); /countries/217/nonexistent_category
 *     fabricated a HIGH-tier page.
 *
 * Tests:
 *   1. Numeric ID still works (happy path neighborhood)
 *   2. Slug redirects to canonical numeric URL (new behavior)
 *   3. Alpha-2 code redirects to canonical numeric URL (new behavior)
 *   4. Unknown slug produces a real 404 (not a reflected-input placeholder)
 *   5. Valid category renders (happy path neighborhood)
 *   6. Invalid category returns 404 (fixes the confabulation vector)
 */
import { test, expect } from "@playwright/test";

test.describe("country slug routing (#426)", () => {
  test("numeric id /countries/217 renders Syria profile", async ({ page }) => {
    const res = await page.goto("/countries/217");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/Syria/i);
  });

  test("slug /countries/syria redirects to /countries/217", async ({ page }) => {
    const res = await page.goto("/countries/syria");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/countries\/\d+/);
    await expect(page).toHaveTitle(/Syria/i);
  });

  test("alpha-2 code /countries/SY redirects to numeric", async ({ page }) => {
    const res = await page.goto("/countries/SY");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/countries\/\d+/);
  });

  test("hyphenated slug /countries/cape-verde redirects", async ({ page }) => {
    // Cape Verde isn't currently in the 89-country dataset (#428) so the
    // redirect may fail with 404 — accept either "redirect to numeric"
    // OR "404", but NEVER "200 with reflected slug in title".
    const res = await page.goto("/countries/cape-verde");
    const status = res?.status() ?? 0;
    const url = page.url();
    const title = await page.title();
    if (status < 400) {
      // Success: must have redirected to numeric ID
      expect(url).toMatch(/\/countries\/\d+/);
    }
    // Title must NEVER echo the slug (the pre-#426 bug)
    expect(title).not.toContain("cape-verde");
    expect(title).not.toContain("cape_verde");
  });

  test("unknown slug /countries/zzznonexistent returns 404", async ({ page }) => {
    const res = await page.goto("/countries/zzznonexistent");
    expect(res?.status()).toBe(404);
  });

  test("valid category /countries/217/civil_war_and_insurgency renders", async ({
    page,
  }) => {
    const res = await page.goto("/countries/217/civil_war_and_insurgency");
    expect(res?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/Syria/i);
    await expect(page).toHaveTitle(/Civil War/i);
  });

  test("invalid category /countries/217/nonexistent_category returns 404", async ({
    page,
  }) => {
    // #426: bad category previously rendered a fabricated HIGH-tier page.
    // Must 404 now — never render a page titled "Syria — Nonexistent Category".
    const res = await page.goto("/countries/217/nonexistent_category");
    expect(res?.status()).toBe(404);
  });
});
