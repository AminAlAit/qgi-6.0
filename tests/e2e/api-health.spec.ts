/**
 * API endpoint contract tests (#425 + #439).
 *
 * Hits each public API route from a fresh session, asserts each
 * returns 2xx + a payload that's at least vaguely the right shape.
 * This is the pre-deploy version of the synthetic monitoring smoke;
 * here we test the local build.
 *
 * History note: every endpoint listed here was 500/503 on prod the
 * day #425 was filed (2026-04-24) because Vercel had no AWS creds.
 * Locking these to 200 in CI prevents the same outage from re-shipping.
 */
import { test, expect } from "@playwright/test";

test.describe("API health", () => {
  test("/api/health returns 200", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
  });

  test("/api/country-risks returns a populated countries dict", async ({ request }) => {
    const res = await request.get("/api/country-risks");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Object.keys(body.countries ?? {}).length).toBeGreaterThan(20);
    // Locked by #431 — the version field is the source of truth for
    // the dashboard scoring label.
    expect(body.version).toMatch(/^V\d+\.\d+(\.\d+)?$/);
  });

  test("/api/recipes/country?country=Syria returns recipes", async ({ request }) => {
    const res = await request.get("/api/recipes/country?country=Syria");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
  });

  test("/api/patterns/lengths requires country args (400 not 500)", async ({
    request,
  }) => {
    const res = await request.get("/api/patterns/lengths");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/);
  });

  test("/api/patterns/lengths with args returns numeric lengths", async ({ request }) => {
    const res = await request.get("/api/patterns/lengths?country_a=217&country_b=228");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(typeof body[0]).toBe("number");
  });
});
