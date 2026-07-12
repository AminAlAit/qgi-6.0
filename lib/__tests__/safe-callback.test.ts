/**
 * lib/safe-callback.ts — post-auth open-redirect guard (CWE-601).
 *
 * These cases pin the security contract: the returned value is fed straight
 * into `window.location.href` after a successful sign-in, so anything that
 * resolves off-origin MUST fall back to the safe default. The backslash cases
 * are the regression guard for the `/\evil.com` bypass a naive prefix check
 * lets through (browsers normalize `/\` to `//` for http/https).
 */
import { describe, it, expect } from "vitest";
import { safeCallbackUrl } from "@/lib/safe-callback";

describe("safeCallbackUrl", () => {
  it("returns the fallback for empty / nullish input", () => {
    expect(safeCallbackUrl(undefined)).toBe("/dashboard");
    expect(safeCallbackUrl(null)).toBe("/dashboard");
    expect(safeCallbackUrl("")).toBe("/dashboard");
  });

  it("honors a custom fallback", () => {
    expect(safeCallbackUrl(null, "/risk-board")).toBe("/risk-board");
  });

  it("accepts genuine same-origin relative paths", () => {
    expect(safeCallbackUrl("/dashboard")).toBe("/dashboard");
    expect(safeCallbackUrl("/risk-board")).toBe("/risk-board");
    expect(safeCallbackUrl("/trends")).toBe("/trends");
    expect(safeCallbackUrl("/countries/IRN")).toBe("/countries/IRN");
  });

  it("preserves query string and hash on a same-origin path", () => {
    expect(safeCallbackUrl("/settings?tab=profile#watchlist")).toBe(
      "/settings?tab=profile#watchlist"
    );
  });

  it("rejects absolute off-origin URLs", () => {
    expect(safeCallbackUrl("https://evil.com/phish")).toBe("/dashboard");
    expect(safeCallbackUrl("http://evil.com")).toBe("/dashboard");
  });

  it("rejects protocol-relative (//host) URLs", () => {
    expect(safeCallbackUrl("//evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("//evil.com/reverify")).toBe("/dashboard");
  });

  it("rejects the backslash bypass (/\\host normalizes to //host)", () => {
    expect(safeCallbackUrl("/\\evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("/\\evil.com/phish")).toBe("/dashboard");
    expect(safeCallbackUrl("/\\/evil.com")).toBe("/dashboard");
    // percent-encoded form an attacker would put in the query string
    expect(safeCallbackUrl(decodeURIComponent("%2F%5Cevil.com"))).toBe("/dashboard");
  });

  it("rejects a same-host-prefix homograph (//localhost.evil.com)", () => {
    expect(safeCallbackUrl("//localhost.evil.com/x")).toBe("/dashboard");
  });

  it("rejects non-http schemes", () => {
    expect(safeCallbackUrl("javascript:alert(1)")).toBe("/dashboard");
    expect(safeCallbackUrl("data:text/html,<h1>x</h1>")).toBe("/dashboard");
  });

  it("rejects bare (non-rooted) relative values", () => {
    expect(safeCallbackUrl("dashboard")).toBe("/dashboard");
    expect(safeCallbackUrl("../etc")).toBe("/dashboard");
  });
});
