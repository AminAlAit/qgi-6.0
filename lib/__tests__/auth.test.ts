import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AuthError, withAuth, requireGroup } from "@/lib/auth";
import type { AuthPayload } from "@/lib/auth";

// Silence console.error in tests
vi.spyOn(console, "error").mockImplementation(() => {});

describe("withAuth", () => {
  beforeEach(() => {
    // Enable SKIP_AUTH so we don't need real Cognito in unit tests
    vi.stubEnv("SKIP_AUTH", "true");
  });

  it("calls handler with dev payload when SKIP_AUTH=true", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withAuth(handler);
    const req = new NextRequest("http://localhost/api/test");
    await wrapped(req);
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ sub: "dev", "cognito:groups": ["pro"] })
    );
  });

  it("returns 401 when SKIP_AUTH=false and no Authorization header", async () => {
    vi.stubEnv("SKIP_AUTH", "false");
    vi.stubEnv("COGNITO_USER_POOL_ID", "eu-central-1_test");

    // Mock jwtVerify to throw
    vi.mock("jose", () => ({
      createRemoteJWKSet: vi.fn(),
      jwtVerify: vi.fn().mockRejectedValue(new Error("invalid")),
    }));

    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const req = new NextRequest("http://localhost/api/test");
    const res = await wrapped(req);
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("requireGroup", () => {
  it("does not throw when user has the required group", () => {
    const payload: AuthPayload = { "cognito:groups": ["pro", "free"] };
    expect(() => requireGroup(payload, "pro")).not.toThrow();
  });

  it("throws AuthError 403 when user lacks the group", () => {
    const payload: AuthPayload = { "cognito:groups": ["free"] };
    expect(() => requireGroup(payload, "pro")).toThrow(AuthError);
    try {
      requireGroup(payload, "pro");
    } catch (err) {
      expect((err as AuthError).status).toBe(403);
    }
  });

  it("throws when groups are missing entirely", () => {
    const payload: AuthPayload = {};
    expect(() => requireGroup(payload, "pro")).toThrow(AuthError);
  });
});
